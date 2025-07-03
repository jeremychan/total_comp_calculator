import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebaseConfig';
import { CompensationData } from '../types';

const LOCAL_STORAGE_KEY = 'tcCalculatorData';

export const getLocalData = (): CompensationData | null => {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading local data:', error);
        return null;
    }
};

export const setLocalData = (data: CompensationData): void => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving local data:', error);
    }
};

export const syncToFirestore = async (user: User, data: CompensationData): Promise<void> => {
    if (!user) {
        console.log('No user provided to syncToFirestore');
        return;
    }

    try {
        console.log('Starting Firestore sync for user:', user.uid);
        const userDocRef = doc(db, 'userData', user.uid);

        // Convert Date objects to strings for Firestore
        const firestoreData = {
            ...data,
            rsuGrants: data.rsuGrants.map(grant => ({
                ...grant,
                grantDate: grant.grantDate.toISOString()
            })),
            lastUpdated: new Date().toISOString(),
            userId: user.uid
        };

        console.log('Writing to Firestore document:', userDocRef.path);
        await setDoc(userDocRef, firestoreData);
        console.log('Firestore write successful');
    } catch (error) {
        console.error('Error syncing to Firestore:', error);
        throw error; // Re-throw to see the error in the calling code
    }
};

export const syncFromFirestore = async (user: User): Promise<CompensationData | null> => {
    if (!user) return null;

    try {
        const userDocRef = doc(db, 'userData', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const cloudData = docSnap.data() as any;

            // Convert date strings back to Date objects
            const compensationData: CompensationData = {
                ...cloudData,
                rsuGrants: cloudData.rsuGrants?.map((grant: any) => ({
                    ...grant,
                    grantDate: new Date(grant.grantDate)
                })) || []
            };

            // Remove Firebase-specific fields
            delete (compensationData as any).lastUpdated;
            delete (compensationData as any).userId;

            return compensationData;
        }
        return null;
    } catch (error) {
        console.error('Error syncing from Firestore:', error);
        return null;
    }
};

export const setupRealtimeSync = (
    user: User,
    onDataUpdate: (data: CompensationData) => void
): (() => void) => {
    if (!user) return () => { };

    const userDocRef = doc(db, 'userData', user.uid);

    return onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as any;

            // Convert date strings back to Date objects
            const compensationData: CompensationData = {
                ...cloudData,
                rsuGrants: cloudData.rsuGrants?.map((grant: any) => ({
                    ...grant,
                    grantDate: new Date(grant.grantDate)
                })) || []
            };

            // Remove Firebase-specific fields
            delete (compensationData as any).lastUpdated;
            delete (compensationData as any).userId;

            onDataUpdate(compensationData);
        }
    });
};

export const mergeDataOnSignIn = async (user: User): Promise<CompensationData | null> => {
    const localData = getLocalData();
    const cloudData = await syncFromFirestore(user);

    // If no local data, use cloud data
    if (!localData) {
        return cloudData;
    }

    // If no cloud data, sync local data to cloud
    if (!cloudData) {
        await syncToFirestore(user, localData);
        return localData;
    }

    // Both exist - for now, prioritize cloud data
    // In a more sophisticated implementation, you could compare timestamps
    // and merge or ask user which to keep
    return cloudData;
}; 