import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';

export type CollectionName = 'drafts' | 'maps' | 'manuscripts' | 'research' | 'chats' | 'researchGroups';

// Generic Save Function
export const saveDocument = async (userId: string, collectionName: CollectionName, data: any) => {
    try {
        const docRef = doc(db, `users/${userId}/${collectionName}`, data.id);
        // Ensure date fields are strings or timestamps
        const payload = {
            ...data,
            updatedAt: Timestamp.now(),
            userId: userId // Optional redundancy
        };
        await setDoc(docRef, payload, { merge: true });
        console.log(`Saved to ${collectionName}: ${data.id}`);
    } catch (e) {
        console.error(`Error saving to ${collectionName}`, e);
        throw e;
    }
};

// Generic Load Function
export const loadCollection = async (userId: string, collectionName: CollectionName) => {
    try {
        const q = query(
            collection(db, `users/${userId}/${collectionName}`),
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
export const deleteDocument = async (userId: string, collectionName: CollectionName, docId: string) => {
    try {
        await deleteDoc(doc(db, `users/${userId}/${collectionName}`, docId));
    } catch (e) {
        console.error(`Error deleting from ${collectionName}`, e);
        throw e;
    }
};

// Save single project-level data (Map, Chat)
export const saveProjectData = async (userId: string, key: string, data: any) => {
    try {
        const docRef = doc(db, `users/${userId}/project`, key);
        await setDoc(docRef, { ...data, updatedAt: Timestamp.now() }, { merge: true });
        console.log(`Saved project data: ${key}`);
    } catch (e) {
        console.error(`Error saving project data ${key}`, e);
    }
};

// Load single project-level data
export const loadProjectData = async (userId: string, key: string) => {
    try {
        const { getDoc } = await import('firebase/firestore');
        const docRef = doc(db, `users/${userId}/project`, key);
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
