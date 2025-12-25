import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, Timestamp, getDoc, collectionGroup, where, updateDoc, arrayUnion } from 'firebase/firestore';

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
}

// Helper to construct path
const getCollectionPath = (userId: string, collectionName: CollectionName, projectId?: string) => {
    if (projectId) {
        return `users/${userId}/projects/${projectId}/${collectionName}`;
    }
    return `users/${userId}/${collectionName}`;
};

// Generic Save Function
export const saveDocument = async (userId: string, collectionName: CollectionName, data: any, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);
        const docRef = doc(db, path, data.id);
        // Ensure date fields are strings or timestamps
        const payload = {
            ...data,
            updatedAt: Timestamp.now(),
            userId: userId // Optional redundancy
        };
        await setDoc(docRef, payload, { merge: true });
        console.log(`Saved to ${path}: ${data.id}`);
    } catch (e) {
        console.error(`Error saving to ${collectionName}`, e);
        throw e;
    }
};

// Generic Load Function
export const loadCollection = async (userId: string, collectionName: CollectionName, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);
        const q = query(
            collection(db, path),
            orderBy('updatedAt', 'desc') // Ensure indexing if needed, or sort on client
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (e) {
        console.error(`Error loading ${collectionName}`, e);
        // Fallback to empty array if index missing or error
        return [];
    }
};

// Generic Delete Function
export const deleteDocument = async (userId: string, collectionName: CollectionName, docId: string, projectId?: string) => {
    try {
        const path = getCollectionPath(userId, collectionName, projectId);
        await deleteDoc(doc(db, path, docId));
    } catch (e) {
        console.error(`Error deleting from ${collectionName}`, e);
        throw e;
    }
};

// Save single project-level data (Map, Chat)
export const saveProjectData = async (userId: string, key: string, data: any, projectId?: string) => {
    try {
        // Project Level Data like 'currentMap' or 'currentChat'
        // If projectId is provided, store it in the project document itself or a subcollection?
        // Let's store it as a special doc in the project's 'settings' or 'data' subcollection to keep it clean,
        // OR just simple: users/{uid}/projects/{pid}/data/{key}

        let path = `users/${userId}/project`;
        if (projectId) {
            path = `users/${userId}/projects/${projectId}/data`;
        }

        const docRef = doc(db, path, key);
        await setDoc(docRef, { ...data, updatedAt: Timestamp.now() }, { merge: true });
        console.log(`Saved project data: ${key} at ${path}`);
    } catch (e) {
        console.error(`Error saving project data ${key}`, e);
    }
};

// Load single project-level data
export const loadProjectData = async (userId: string, key: string, projectId?: string) => {
    try {
        let path = `users/${userId}/project`;
        if (projectId) {
            path = `users/${userId}/projects/${projectId}/data`;
        }

        const docRef = doc(db, path, key);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return snapshot.data();
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

        await setDoc(docRef, projectData);
        return newProjectId;
    } catch (e) {
        console.error("Error creating project", e);
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
    role: 'owner' | 'member';
}

export interface TeamData {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    members: TeamMember[];
    memberEmails: string[]; // For efficient querying
    sharedProjects?: string[]; // Array of Project IDs shared with this team
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
export const createTeam = async (userId: string, userEmail: string, name: string, description: string = ''): Promise<string> => {
    try {
        const newTeamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, 'teams', newTeamId);

        const teamData: TeamData = {
            id: newTeamId,
            name,
            description,
            ownerId: userId,
            members: [{ uid: userId, email: userEmail, role: 'owner' }],
            memberEmails: [userEmail], // Initial member email
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
export const createTeamWithIndex = async (userId: string, userEmail: string, name: string, description: string = ''): Promise<string> => {
    try {
        const newTeamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, 'teams', newTeamId);

        // Extended interface for indexing
        const teamData = {
            id: newTeamId,
            name,
            description,
            ownerId: userId,
            members: [{ uid: userId, email: userEmail, role: 'owner' }],
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

// Chat Functions
export const sendTeamMessage = async (teamId: string, senderId: string, senderName: string, text: string, attachments: any[] = []) => {
    try {
        const messagesRef = collection(db, `teams/${teamId}/messages`);
        await setDoc(doc(messagesRef), {
            text,
            senderId,
            senderName,
            attachments,
            createdAt: Timestamp.now()
        });
    } catch (e) {
        console.error("Error sending message", e);
        throw e;
    }
};

// Real-time listener for messages will be done in the component using onSnapshot
