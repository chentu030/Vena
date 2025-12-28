import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, Timestamp, getDoc, collectionGroup, where, updateDoc, arrayUnion, addDoc, onSnapshot, writeBatch } from 'firebase/firestore';

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyeGIh0Dg7CKujV3HPDkx__DnyHrVrkiuqGnnow4YXhIQjA10aDifnDU9DntUFgwRTO/exec";

export type CollectionName = 'drafts' | 'maps' | 'manuscripts' | 'research' | 'chats' | 'researchGroups';

export interface ProjectData {
    id: string;
    name: string;
    description?: string;
    icon?: string; // Icon name from lucide-react
    color?: string; // Tailwind color class
    tags?: string[];
    isPublic?: boolean;
    allowPublicEditing?: boolean;
    authorDisplayName?: string;
    authorEmail?: string;
    createdAt: any;
    updatedAt: any;
    userId: string;
    driveId?: string;
}

// Helper to construct path
const getCollectionPath = (userId: string, collectionName: CollectionName, projectId?: string) => {
    if (projectId) {
        return `users/${userId}/projects/${projectId}/${collectionName}`;
    }
    return `users/${userId}/${collectionName}`;
};

// Generic Save Function
const sanitizeData = (data: any): any => {
    // Relaxed limits - we rely on chunking for size management now
    const MAX_STRING_LENGTH = 10000000; // 10MB
    const MAX_DEPTH = 8;
    const MAX_ARRAY_LENGTH = 5000;

    const traverse = (obj: any, depth: number): any => {
        if (depth > MAX_DEPTH) return '[Max Depth Exceeded]';

        if (typeof obj === 'string') {
            if (obj.length > MAX_STRING_LENGTH) {
                console.warn(`Truncating huge string field (Length: ${obj.length})`);
                return obj.substring(0, 500) + '...[Content Truncated - Too Large]';
            }
            return obj;
        }

        if (Array.isArray(obj)) {
            if (obj.length > MAX_ARRAY_LENGTH) {
                console.warn(`Truncating large array (Length: ${obj.length})`);
                return obj.slice(0, MAX_ARRAY_LENGTH).map(item => traverse(item, depth + 1));
            }
            return obj.map(item => traverse(item, depth + 1));
        }

        if (obj && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
                newObj[key] = traverse(obj[key], depth + 1);
            }
            return newObj;
        }
        return obj;
    };

    return traverse(data, 0);
};

export const saveDocument = async (userId: string, collectionName: CollectionName, data: any, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);
        const docRef = doc(db, path, data.id);

        // Sanitize data
        const cleanData = sanitizeData(data);
        const payload = {
            ...cleanData,
            updatedAt: Timestamp.now(),
            userId: userId
        };

        const jsonString = JSON.stringify(payload);
        const payloadSize = jsonString.length;

        if (payloadSize > 900000) {
            console.log(`Document too large (${payloadSize} bytes) for ${collectionName}/${data.id}. Using chunked storage.`);

            // Chunking Strategy
            const CHUNK_SIZE = 500000;
            const chunks = [];
            for (let i = 0; i < payloadSize; i += CHUNK_SIZE) {
                chunks.push(jsonString.substring(i, i + CHUNK_SIZE));
            }

            const batch = writeBatch(db);
            const chunksRef = collection(db, path, data.id, 'chunks');

            // Save chunks
            chunks.forEach((chunkStr, index) => {
                const chunkDoc = doc(chunksRef, index.toString());
                batch.set(chunkDoc, { data: chunkStr, index });
            });

            // Save Manifest (exclude heavy content if possible, but for generic object we just omit content if we knew the field)
            // For now, we save a lightweight manifest.
            const { content, ...metaData } = payload; // Try to extract 'content' if it exists to keep manifest small
            const manifest = {
                ...metaData, // Persist metadata
                chunked: true,
                chunkCount: chunks.length,
                totalSize: payloadSize,
                updatedAt: Timestamp.now()
            };

            batch.set(docRef, manifest);
            await batch.commit();
            console.log(`Saved ${chunks.length} chunks for ${data.id}`);

        } else {
            // Normal Save
            await setDoc(docRef, { ...payload, chunked: false }, { merge: true });
            console.log(`Saved to ${path}: ${data.id}`);
        }
    } catch (e) {
        console.error(`Error saving to ${collectionName}`, e);
    }
};

export const loadCollection = async (userId: string, collectionName: CollectionName, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);
        const q = query(
            collection(db, path),
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);

        // Process results - handle chunked documents
        const results = await Promise.all(snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();

            if (data.chunked && data.chunkCount > 0) {
                try {
                    // Load chunks
                    const chunksRef = collection(db, path, docSnap.id, 'chunks');
                    const chunkQ = query(chunksRef, orderBy('index', 'asc'));
                    const chunkSnaps = await getDocs(chunkQ);

                    let fullJson = '';
                    chunkSnaps.forEach(c => fullJson += c.data().data);

                    if (fullJson) {
                        const parsed = JSON.parse(fullJson);
                        return { ...parsed, id: docSnap.id };
                    }
                } catch (err) {
                    console.error(`Failed to load chunks for ${docSnap.id}`, err);
                    // Return manifest as fallback (incomplete data is better than crash)
                    return { ...data, id: docSnap.id, error: 'Load Failed' };
                }
            }
            return { ...data, id: docSnap.id };
        }));

        return results;
    } catch (e) {
        console.error(`Error loading ${collectionName}`, e);
        return [];
    }
};

export const deleteDocument = async (userId: string, collectionName: CollectionName, docId: string, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);

        // 1. Delete chunks subcollection if exists (Generic approach: list and delete)
        // Note: Client SDK can't delete collection directly, must delete docs.
        const chunksRef = collection(db, path, docId, 'chunks');
        const chunkSnaps = await getDocs(chunksRef);

        const batch = writeBatch(db);
        chunkSnaps.forEach(c => batch.delete(c.ref));

        // 2. Delete main doc
        const docRef = doc(db, path, docId);
        batch.delete(docRef);

        await batch.commit();
    } catch (e) {
        console.error(`Error deleting from ${collectionName}`, e);
        throw e;
    }
};

// Save single project-level data (Map, Chat) - WITH CHUNKING
export const saveProjectData = async (userId: string, key: string, data: any, projectId?: string) => {
    try {
        let path = `users/${userId}/project`;
        if (projectId) {
            path = `users/${userId}/projects/${projectId}/data`;
        }
        const docRef = doc(db, path, key);

        // Sanitize (basic checks)
        const cleanData = sanitizeData(data);
        const payload = { ...cleanData, updatedAt: Timestamp.now() };

        // Check Size
        const jsonString = JSON.stringify(payload);
        const totalSize = jsonString.length;

        if (totalSize > 900000) { // > 900KB -> Chunk it
            console.log(`Payload large (${totalSize} bytes), using chunked storage for ${key}...`);

            // 1. Split into chunks
            const CHUNK_SIZE = 500000; // 500KB safe margin
            const chunks = [];
            for (let i = 0; i < totalSize; i += CHUNK_SIZE) {
                chunks.push(jsonString.substring(i, i + CHUNK_SIZE));
            }

            // 2. Save Chunks to Subcollection
            const batch = writeBatch(db);
            const chunksRef = collection(db, path, key, 'chunks');

            chunks.forEach((chunkStr, index) => {
                const chunkDoc = doc(chunksRef, index.toString());
                batch.set(chunkDoc, { data: chunkStr, index });
            });

            // 3. Save Manifest
            batch.set(docRef, {
                chunked: true,
                chunkCount: chunks.length,
                totalSize,
                updatedAt: Timestamp.now()
            });

            await batch.commit();
            console.log(`Saved ${chunks.length} chunks for ${key}`);

        } else {
            // Small enough data - save normally
            await setDoc(docRef, { ...payload, chunked: false }, { merge: true });
            console.log(`Saved project data: ${key} at ${path}`);
        }

    } catch (e) {
        console.error(`Error saving project data ${key}`, e);
    }
};

// Load single project-level data - WITH CHUNK SUPPORT
export const loadProjectData = async (userId: string, key: string, projectId?: string) => {
    try {
        let path = `users/${userId}/project`;
        if (projectId) {
            path = `users/${userId}/projects/${projectId}/data`;
        }

        const docRef = doc(db, path, key);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data();

            // Check if chunked
            if (data.chunked && data.chunkCount > 0) {
                console.log(`Detected chunked data for ${key}, loading ${data.chunkCount} segments...`);
                // Load chunks
                const chunksRef = collection(db, path, key, 'chunks');
                const q = query(chunksRef, orderBy('index', 'asc')); // Ensure order
                const chunkSnaps = await getDocs(q);

                let fullJson = '';
                chunkSnaps.forEach(snap => {
                    fullJson += snap.data().data;
                });

                if (fullJson) {
                    try {
                        return JSON.parse(fullJson);
                    } catch (parseError) {
                        console.error("Failed to parse chunked JSON", parseError);
                        return null;
                    }
                }
            }

            return data;
        }
        return null;
    } catch (e) {
        console.error(`Error loading project data ${key}`, e);
        return null;
    }
};


// --- Project Management Functions ---

export const createProject = async (
    userId: string,
    name: string,
    description?: string,
    icon?: string,
    color?: string,
    tags?: string[],
    isPublic?: boolean,
    authorDisplayName?: string,
    authorEmail?: string,
    allowPublicEditing?: boolean
): Promise<string> => {
    try {
        const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, `users/${userId}/projects`, newProjectId);

        const projectData: ProjectData = {
            id: newProjectId,
            name,
            description: description || '',
            icon: icon || 'Folder',
            color: color || 'blue',
            tags: tags || [],
            isPublic: isPublic || false,
            allowPublicEditing: allowPublicEditing || false,
            authorDisplayName: authorDisplayName || 'Anonymous',
            authorEmail: authorEmail || '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            userId
        };

        // Create Folder in Drive for Project
        try {
            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_folder',
                    name: name,
                    parentId: null // Root for now, or maybe a 'Projects' folder if we have one
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                projectData.driveId = data.folderId;
            }
        } catch (e) {
            console.error("GAS Project Folder Creation Failed", e);
        }

        await setDoc(docRef, projectData);
        return newProjectId;
    } catch (e) {
        console.error("Error creating project", e);
        throw e;
    }
};

export const updateTeam = async (teamId: string, updates: Partial<TeamData>) => {
    try {
        const docRef = doc(db, 'teams', teamId);

        // If renaming, sync with Drive
        if (updates.name) {
            const teamSnap = await getDoc(docRef);
            const teamData = teamSnap.data() as TeamData;

            if (teamData?.driveId) {
                try {
                    await fetch(GAS_API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'rename',
                            id: teamData.driveId,
                            name: updates.name
                        })
                    });
                } catch (gasError) {
                    console.error("Failed to rename team folder in Drive", gasError);
                }
            }
        }

        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (e) {
        console.error("Error updating team", e);
        throw e;
    }
};

export const updateProject = async (userId: string, projectId: string, data: Partial<ProjectData>) => {
    try {
        const docRef = doc(db, `users/${userId}/projects`, projectId);
        await setDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        }, { merge: true });
    } catch (e) {
        console.error("Error updating project", e);
        throw e;
    }
};

export const getUserProjects = async (userId: string): Promise<ProjectData[]> => {
    try {
        const q = query(
            collection(db, `users/${userId}/projects`),
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as ProjectData);
    } catch (e) {
        // If query fails (e.g., index missing), return empty. 
        // Note: 'projects' collection might need index on updatedAt
        console.error("Error fetching projects", e);
        return [];
    }
};

export const getPublicProjects = async (): Promise<ProjectData[]> => {
    try {
        const q = query(
            collectionGroup(db, 'projects'),
            where('isPublic', '==', true),
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as ProjectData);
    } catch (e) {
        console.error("Error fetching public projects", e);
        return [];
    }
};

export const getProjectDetails = async (userId: string, projectId: string): Promise<ProjectData | null> => {
    try {
        const docRef = doc(db, `users/${userId}/projects`, projectId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return snapshot.data() as ProjectData;
        }
        return null;
    } catch (e) {
        console.error("Error fetching project details", e);
        return null;
    }
};

export const deleteProject = async (userId: string, projectId: string) => {
    try {
        // Note: Firestore does not automatically delete subcollections. 
        // A proper implementation would use a Callable Cloud Function to recursively delete.
        // For client-side only, we might leave orphans or try to delete known collections.
        // For now, just delete the project metadata document.
        await deleteDoc(doc(db, `users/${userId}/projects`, projectId));
    } catch (e) {
        console.error("Error deleting project", e);
        throw e;
    }
};
// ... existing code ...

// --- TEAMS FEATURE ---

export interface TeamMember {
    uid?: string; // Optional if pending invite
    email: string;
    role: 'owner' | 'admin' | 'member';
    status?: 'online' | 'offline' | 'idle' | 'hidden';
    photoURL?: string;
    displayName?: string;
}

export interface TeamData {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    members: TeamMember[];
    memberEmails: string[]; // For efficient querying
    sharedProjects?: string[]; // Array of Project IDs shared with this team
    driveId?: string; // Google Drive Folder ID
    createdAt: any;
    updatedAt: any;
}

export interface TeamMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    attachments?: {
        name: string;
        url: string;
        type: string;
    }[];
    createdAt: any;
}

// Create a new team
export const createTeam = async (userId: string, userEmail: string, name: string, description: string = '', photoURL?: string, displayName?: string): Promise<string> => {
    try {
        const newTeamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, 'teams', newTeamId);

        let driveId = undefined;
        // Call GAS to create Team Folder in Drive
        try {
            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_folder',
                    name: name,
                    parentId: null // Create at root
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                driveId = data.folderId; // Use generic ID from GAS
            } else {
                console.warn("GAS Team Folder Creation Failed", data);
            }
        } catch (gasError) {
            console.error("GAS Fetch Error during Team Creation", gasError);
        }

        const teamData: TeamData = {
            id: newTeamId,
            name,
            description,
            ownerId: userId,
            members: [{
                uid: userId,
                email: userEmail,
                role: 'owner',
                photoURL: photoURL || '',
                displayName: displayName || userEmail.split('@')[0]
            }],
            memberEmails: [userEmail], // Initial member email
            driveId, // Save Drive Folder ID
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(docRef, teamData);
        return newTeamId;
    } catch (e) {
        console.error("Error creating team", e);
        throw e;
    }
};

// Get teams for a specific user (where they are a member)
export const getUserTeams = async (userEmail: string): Promise<TeamData[]> => {
    try {
        // Query teams where 'members' array contains an object with this email? 
        // Firestore array-contains-any works on simple values or exact objects. 
        // We might need a separate 'memberEmails' array for easy querying.
        // Let's optimize: Add 'memberEmails' field to TeamData for querying.

        const q = query(
            collection(db, 'teams'),
            where('memberEmails', 'array-contains', userEmail),
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as TeamData);
    } catch (e) {
        console.error("Error fetching user teams", e);
        return [];
    }
};

// Share a project with a team
export const shareProjectWithTeam = async (teamId: string, projectId: string) => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        // Use arrayUnion to add without duplicates
        await updateDoc(teamRef, {
            sharedProjects: arrayUnion(projectId)
        });
    } catch (e) {
        console.error("Error sharing project", e);
        throw e;
    }
};

// Fetch details of multiple projects by ID
export const getProjectsByIds = async (projectIds: string[]): Promise<ProjectData[]> => {
    if (!projectIds || projectIds.length === 0) return [];
    try {
        // Firestore 'in' query supports up to 10 items. For more, we need batching or client-side mapping.
        // Since project IDs might be across different users (if we allow sharing *any* project),
        // we can't easily query `users/{uid}/projects` with a simple `in` query because it's a subcollection query.
        // A collectionGroup query with `where('id', 'in', projectIds)` works IF we have 'id' field indexed.

        // Simpler approach for now: We might assume the current user is the owner or we fetch one by one?
        // Actually, `collectionGroup` is best.

        const q = query(
            collectionGroup(db, 'projects'),
            where('id', 'in', projectIds.slice(0, 10)) // Limit 10 for safety
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as ProjectData);
    } catch (e) {
        console.error("Error fetching projects by IDs", e);
        return [];
    }
};

// Update createTeam to include memberEmails
export const createTeamWithIndex = async (userId: string, userEmail: string, name: string, description: string = '', photoURL?: string, displayName?: string): Promise<string> => {
    try {
        const newTeamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, 'teams', newTeamId);

        // Extended interface for indexing
        const teamData = {
            id: newTeamId,
            name,
            description,
            ownerId: userId,
            members: [{
                uid: userId,
                email: userEmail,
                role: 'owner',
                photoURL: photoURL || '',
                displayName: displayName || userEmail.split('@')[0]
            }],
            memberEmails: [userEmail], // For querying
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(docRef, teamData);
        return newTeamId;
    } catch (e) {
        console.error("Error creating team", e);
        throw e;
    }
};

export const getTeam = async (teamId: string): Promise<TeamData | null> => {
    try {
        const docRef = doc(db, 'teams', teamId);
        const snap = await getDoc(docRef);
        if (snap.exists()) return snap.data() as TeamData;
        return null;
    } catch (e) {
        console.error("Error fetching team", e);
        return null;
    }
};

export const inviteMember = async (teamId: string, email: string) => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) throw new Error("Team not found");

        const teamData = teamSnap.data();
        const currentMembers = teamData.members || [];
        const currentEmails = teamData.memberEmails || [];

        if (currentEmails.includes(email)) return; // Already a member

        const newMembers = [...currentMembers, { email, role: 'member' }]; // uid is undefined until they join/login? actually we just track by email for now
        const newEmails = [...currentEmails, email];

        await setDoc(teamRef, { members: newMembers, memberEmails: newEmails }, { merge: true });
    } catch (e) {
        console.error("Error inviting member", e);
        throw e;
    }
};

// Member Management
export const removeTeamMember = async (teamId: string, email: string) => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;

        const data = teamSnap.data() as TeamData;
        const newMembers = (data.members || []).filter(m => m.email !== email);
        const newEmails = (data.memberEmails || []).filter(e => e !== email);

        await updateDoc(teamRef, {
            members: newMembers,
            memberEmails: newEmails
        });
    } catch (e) {
        console.error("Error removing member", e);
        throw e;
    }
};

export const updateTeamMemberRole = async (teamId: string, email: string, role: 'admin' | 'member') => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;

        const data = teamSnap.data() as TeamData;
        const newMembers = (data.members || []).map(m =>
            m.email === email ? { ...m, role } : m
        );

        await updateDoc(teamRef, { members: newMembers });
    } catch (e) {
        console.error("Error updating member role", e);
        throw e;
    }
};

export const updateMemberStatus = async (teamId: string, email: string, status: 'online' | 'offline' | 'idle' | 'hidden') => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;

        const data = teamSnap.data() as TeamData;
        const newMembers = (data.members || []).map(m =>
            m.email === email ? { ...m, status } : m
        );

        // This might interpret as a "write" too often for high frequency, but fine for manual status toggle
        await updateDoc(teamRef, { members: newMembers });
    } catch (e) {
        console.error("Error updating member status", e);
    }
};

// Project Management
export const removeProjectFromTeam = async (teamId: string, projectId: string) => {
    try {
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return;

        const data = teamSnap.data() as TeamData;
        const newProjects = (data.sharedProjects || []).filter(id => id !== projectId);

        await updateDoc(teamRef, { sharedProjects: newProjects });
    } catch (e) {
        console.error("Error removing project", e);
        throw e;
    }
};

// Cloud Drive / Files
export interface TeamFile {
    id: string;
    name: string;
    url?: string;
    type: string; // 'folder' | mimetype
    size?: number; // bytes
    parentId: string | null;
    uploadedBy: string;
    uploadedAt: any;
    color?: string;
    icon?: string;
    driveId?: string;
    storagePath?: string; // Firebase Storage path
    thumbnailUrl?: string; // PDF first page thumbnail
}
// File Management
// File Management
export const renameTeamFile = async (teamId: string, fileId: string, newName: string) => {
    try {
        const docRef = doc(db, `teams/${teamId}/files`, fileId);

        // 1. Get current file to check for driveId
        const fileSnap = await getDoc(docRef);
        const fileData = fileSnap.data() as TeamFile;

        // 2. If it has a driveId, rename in Drive via GAS
        if (fileData?.driveId) {
            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'rename',
                    id: fileData.driveId,
                    name: newName
                })
            });
            const data = await res.json();
            if (data.status !== 'success') {
                console.warn("GAS Rename warning:", data.message);
                // Continue to rename in Firestore anyway? Or throw?
                // Throwing might be safer to keep sync.
                throw new Error("Failed to rename in Drive: " + data.message);
            }
        }

        await updateDoc(docRef, { name: newName });
    } catch (e) {
        console.error("Error renaming file", e);
        throw e;
    }
};

export const moveTeamFile = async (teamId: string, fileId: string, newParentId: string | null) => {
    try {
        const docRef = doc(db, `teams/${teamId}/files`, fileId);
        await updateDoc(docRef, { parentId: newParentId });
    } catch (e) {
        console.error("Error moving file", e);
        throw e;
    }
};

export const updateFolderStyle = async (teamId: string, fileId: string, color: string, icon: string) => {
    try {
        const docRef = doc(db, `teams/${teamId}/files`, fileId);
        await updateDoc(docRef, { color, icon });
    } catch (e) {
        console.error("Error updating folder style", e);
        throw e;
    }
};

export const addTeamFile = async (teamId: string, file: Omit<TeamFile, 'id'> & { id?: string }) => {
    try {
        const filesRef = collection(db, `teams/${teamId}/files`);
        // 如果沒有提供 id，生成一個新的
        const fileId = file.id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fileWithId = { ...file, id: fileId };
        await setDoc(doc(filesRef, fileId), fileWithId);
    } catch (e) {
        console.error("Error adding team file", e);
        throw e;
    }
};

export const createTeamFolder = async (teamId: string, name: string, parentId: string | null = null, createdBy: string, color?: string, icon?: string) => {
    try {
        const folderId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, `teams/${teamId}/files`, folderId);

        let driveId = undefined;
        let driveUrl = undefined;

        // 1. Determine parent Drive ID
        let parentDriveId = null;
        if (parentId) {
            const parentDoc = await getDoc(doc(db, `teams/${teamId}/files`, parentId));
            if (parentDoc.exists()) {
                parentDriveId = parentDoc.data().driveId;
            }
        } else {
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            if (teamDoc.exists()) {
                parentDriveId = teamDoc.data().driveId;
            }
        }

        // 2. Call GAS to create folder in Drive
        try {
            const res = await fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_folder',
                    name: name,
                    parentId: parentDriveId // If null, GAS defaults to ROOT_FOLDER_ID
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                driveId = data.folderId;
                driveUrl = data.url;
            } else {
                console.error("GAS Create Folder Failed", data);
            }
        } catch (gasError) {
            console.error("GAS Fetch Error", gasError);
        }

        await setDoc(docRef, {
            id: folderId,
            name,
            type: 'folder',
            parentId,
            driveId, // Save Drive ID
            url: driveUrl,
            uploadedBy: createdBy,
            uploadedAt: Timestamp.now(),
            color: color || 'blue',
            icon: icon || 'Folder'
        });

        return folderId;
    } catch (e) {
        console.error("Error creating folder", e);
        throw e;
    }
};

export const removeTeamFile = async (teamId: string, fileId: string) => {
    try {
        await deleteDoc(doc(db, `teams/${teamId}/files`, fileId));
    } catch (e) {
        console.error("Error removing file", e);
        throw e;
    }
};

// Chat Functions
export const sendTeamMessage = async (teamId: string, senderId: string, senderName: string, text: string, attachments: any[] = []) => {
    try {
        const messagesRef = collection(db, `teams/${teamId}/messages`);

        // Add message
        await setDoc(doc(messagesRef), {
            text,
            senderId,
            senderName,
            attachments,
            createdAt: Timestamp.now()
        });

        // Note: Attachments are saved to the '聊天室資料' folder by the frontend (page.tsx)
        // Do NOT save again here to avoid duplicates
    } catch (e) {
        console.error("Error sending message", e);
        throw e;
    }
};

// Real-time listener for messages will be done in the component using onSnapshot

// Research Management
export const getUserResearchGroups = async (userId: string) => {
    return await loadCollection(userId, 'researchGroups');
};

// User Management Helpers
export const getUsersByEmails = async (emails: string[]) => {
    if (!emails || emails.length === 0) return [];
    try {
        // Firestore 'in' query supports up to 10 values (or 30? usually 10 for OR, 30 for IN). Safest is chunking by 10.
        const chunks = [];
        for (let i = 0; i < emails.length; i += 10) {
            chunks.push(emails.slice(i, i + 10));
        }

        const results: any[] = [];
        for (const chunk of chunks) {
            const q = query(collection(db, 'users'), where('email', 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        }
        return results;
    } catch (e) {
        console.error("Error fetching users by emails", e);
        return [];
    }
};

export const subscribeToFileMessages = (teamId: string, fileId: string, callback: (msgs: any[]) => void) => {
    const q = query(collection(db, `teams/${teamId}/files/${fileId}/messages`), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(msgs);
    });
};

export const sendTeamFileMessage = async (teamId: string, fileId: string, message: any) => {
    const colRef = collection(db, `teams/${teamId}/files/${fileId}/messages`);
    await addDoc(colRef, {
        ...message,
        createdAt: Timestamp.now()
    });
};

// AI Chat History Functions (Private per user)
export const subscribeToAiChatHistory = (userId: string, teamId: string, fileId: string, callback: (msgs: any[]) => void) => {
    const q = query(collection(db, `users/${userId}/fileAiChats/${teamId}_${fileId}/messages`), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(msgs);
    });
};

export const addAiChatMessage = async (userId: string, teamId: string, fileId: string, message: { role: 'user' | 'model'; text: string }) => {
    const colRef = collection(db, `users/${userId}/fileAiChats/${teamId}_${fileId}/messages`);
    await addDoc(colRef, {
        ...message,
        createdAt: Timestamp.now()
    });
};

export const clearAiChatHistory = async (userId: string, teamId: string, fileId: string) => {
    const colRef = collection(db, `users/${userId}/fileAiChats/${teamId}_${fileId}/messages`);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

// ==================== COMMUNITY FEATURES ====================

export interface Community {
    id: string;
    name: string;
    displayName: string;
    description: string;
    icon?: string;
    bannerUrl?: string;
    createdBy: string;
    createdAt: any;
    memberCount: number;
    rules?: string[];
    tags?: string[];
}

export interface CommunityPost {
    id: string;
    communityId: string;
    communityName: string;
    title: string;
    content: string;
    type: 'text' | 'link' | 'paper' | 'image' | 'video' | 'audio' | 'mixed';
    linkUrl?: string;
    imageUrl?: string;
    paperDoi?: string;
    authorId: string;
    authorName: string;
    authorEmail: string;
    upvotes: string[]; // Array of user IDs
    downvotes: string[];
    commentCount: number;
    createdAt: any;
    updatedAt: any;
    attachments?: PostAttachment[];
}

export interface PostAttachment {
    id: string; // uuid or random string
    url: string;
    type: 'image' | 'video' | 'audio' | 'file';
    name: string;
    size: number;
    mimeType: string;
}

export interface PostComment {
    id: string;
    postId: string;
    parentId: string | null; // For nested comments
    content: string;
    authorId: string;
    authorName: string;
    upvotes: string[];
    downvotes: string[];
    createdAt: any;
    depth: number;
}

export interface UserKarma {
    postKarma: number;
    commentKarma: number;
    updatedAt: any;
}

// Community CRUD
export const createCommunity = async (community: Omit<Community, 'id' | 'createdAt' | 'memberCount'>) => {
    const docRef = doc(collection(db, 'communities'));
    await setDoc(docRef, {
        ...community,
        id: docRef.id,
        memberCount: 1,
        createdAt: Timestamp.now()
    });
    return docRef.id;
};

export const getCommunities = async (): Promise<Community[]> => {
    const q = query(collection(db, 'communities'), orderBy('memberCount', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Community));
};

export const getCommunity = async (communityId: string): Promise<Community | null> => {
    const docRef = doc(db, 'communities', communityId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Community : null;
};

export const subscribeToCommunities = (callback: (communities: Community[]) => void) => {
    const q = query(collection(db, 'communities'), orderBy('memberCount', 'desc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Community)));
    });
};

// Post CRUD
export const createPost = async (post: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'upvotes' | 'downvotes' | 'commentCount'>) => {
    const docRef = doc(collection(db, 'posts'));

    // Clean undefined values - Firestore doesn't accept undefined
    const cleanPost: Record<string, any> = {};
    Object.entries(post).forEach(([key, value]) => {
        if (value !== undefined) {
            cleanPost[key] = value;
        }
    });

    await setDoc(docRef, {
        ...cleanPost,
        id: docRef.id,
        upvotes: [post.authorId], // Auto-upvote own post
        downvotes: [],
        commentCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });
    // Update user karma
    await updateUserKarma(post.authorId, 1, 0);
    return docRef.id;
};

export const getPosts = async (communityId?: string, sortBy: 'hot' | 'new' | 'top' = 'hot'): Promise<CommunityPost[]> => {
    let q;
    if (communityId) {
        q = query(collection(db, 'posts'), where('communityId', '==', communityId), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    }
    const snapshot = await getDocs(q);
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost));

    // Sort by algorithm
    if (sortBy === 'hot') {
        posts = posts.sort((a, b) => {
            const scoreA = (a.upvotes.length - a.downvotes.length) / Math.pow((Date.now() - a.createdAt?.toDate?.()?.getTime?.() || 0) / 3600000 + 2, 1.8);
            const scoreB = (b.upvotes.length - b.downvotes.length) / Math.pow((Date.now() - b.createdAt?.toDate?.()?.getTime?.() || 0) / 3600000 + 2, 1.8);
            return scoreB - scoreA;
        });
    } else if (sortBy === 'top') {
        posts = posts.sort((a, b) => (b.upvotes.length - b.downvotes.length) - (a.upvotes.length - a.downvotes.length));
    }

    return posts;
};

export const subscribeToPosts = (callback: (posts: CommunityPost[]) => void, communityId?: string) => {
    let q;
    if (communityId) {
        q = query(collection(db, 'posts'), where('communityId', '==', communityId), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    }
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost)));
    });
};

export const getPost = async (postId: string): Promise<CommunityPost | null> => {
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as CommunityPost : null;
};

export const votePost = async (postId: string, odId: string, voteType: 'up' | 'down') => {
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const post = docSnap.data() as CommunityPost;
    let newUpvotes = [...post.upvotes];
    let newDownvotes = [...post.downvotes];
    let karmaChange = 0;

    if (voteType === 'up') {
        if (newUpvotes.includes(odId)) {
            newUpvotes = newUpvotes.filter(id => id !== odId);
            karmaChange = -1;
        } else {
            newUpvotes.push(odId);
            karmaChange = 1;
            if (newDownvotes.includes(odId)) {
                newDownvotes = newDownvotes.filter(id => id !== odId);
                karmaChange = 2;
            }
        }
    } else {
        if (newDownvotes.includes(odId)) {
            newDownvotes = newDownvotes.filter(id => id !== odId);
            karmaChange = 1;
        } else {
            newDownvotes.push(odId);
            karmaChange = -1;
            if (newUpvotes.includes(odId)) {
                newUpvotes = newUpvotes.filter(id => id !== odId);
                karmaChange = -2;
            }
        }
    }

    await updateDoc(docRef, { upvotes: newUpvotes, downvotes: newDownvotes });
    await updateUserKarma(post.authorId, karmaChange, 0);
};

export const deletePost = async (postId: string) => {
    await deleteDoc(doc(db, 'posts', postId));
};

// Comment CRUD
export const createComment = async (comment: Omit<PostComment, 'id' | 'createdAt' | 'upvotes' | 'downvotes'>) => {
    const docRef = doc(collection(db, 'comments'));
    await setDoc(docRef, {
        ...comment,
        id: docRef.id,
        upvotes: [comment.authorId],
        downvotes: [],
        createdAt: Timestamp.now()
    });

    // Update post comment count
    const postRef = doc(db, 'posts', comment.postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        await updateDoc(postRef, { commentCount: (postSnap.data().commentCount || 0) + 1 });
    }

    // Update karma
    await updateUserKarma(comment.authorId, 0, 1);
    return docRef.id;
};

export const getComments = async (postId: string): Promise<PostComment[]> => {
    const q = query(collection(db, 'comments'), where('postId', '==', postId), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostComment));
};

export const subscribeToComments = (postId: string, callback: (comments: PostComment[]) => void) => {
    const q = query(collection(db, 'comments'), where('postId', '==', postId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostComment)));
    });
};

export const voteComment = async (commentId: string, odId: string, voteType: 'up' | 'down') => {
    const docRef = doc(db, 'comments', commentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const comment = docSnap.data() as PostComment;
    let newUpvotes = [...comment.upvotes];
    let newDownvotes = [...comment.downvotes];
    let karmaChange = 0;

    if (voteType === 'up') {
        if (newUpvotes.includes(odId)) {
            newUpvotes = newUpvotes.filter(id => id !== odId);
            karmaChange = -1;
        } else {
            newUpvotes.push(odId);
            karmaChange = 1;
            if (newDownvotes.includes(odId)) {
                newDownvotes = newDownvotes.filter(id => id !== odId);
                karmaChange = 2;
            }
        }
    } else {
        if (newDownvotes.includes(odId)) {
            newDownvotes = newDownvotes.filter(id => id !== odId);
            karmaChange = 1;
        } else {
            newDownvotes.push(odId);
            karmaChange = -1;
            if (newUpvotes.includes(odId)) {
                newUpvotes = newUpvotes.filter(id => id !== odId);
                karmaChange = -2;
            }
        }
    }

    await updateDoc(docRef, { upvotes: newUpvotes, downvotes: newDownvotes });
    await updateUserKarma(comment.authorId, 0, karmaChange);
};

export const deleteComment = async (commentId: string, postId: string) => {
    await deleteDoc(doc(db, 'comments', commentId));

    // Update post comment count
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        const currentCount = postSnap.data().commentCount || 0;
        await updateDoc(postRef, { commentCount: Math.max(0, currentCount - 1) });
    }
    // We don't strictly revert karma on simple delete to avoid complex calculation of net votes lost, 
    // but you could decrement the base +1 point if desired. Keeping it simple for now.
};

// User Karma
export const getUserKarma = async (userId: string): Promise<UserKarma> => {
    const docRef = doc(db, 'userKarma', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as UserKarma;
    }
    return { postKarma: 0, commentKarma: 0, updatedAt: null };
};

export const updateUserKarma = async (userId: string, postKarmaDelta: number, commentKarmaDelta: number) => {
    const docRef = doc(db, 'userKarma', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const current = docSnap.data() as UserKarma;
        await updateDoc(docRef, {
            postKarma: current.postKarma + postKarmaDelta,
            commentKarma: current.commentKarma + commentKarmaDelta,
            updatedAt: Timestamp.now()
        });
    } else {
        await setDoc(docRef, {
            postKarma: postKarmaDelta,
            commentKarma: commentKarmaDelta,
            updatedAt: Timestamp.now()
        });
    }
};
