import { signInWithPopup, signOut, GoogleAuthProvider, User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<User | null> => {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        return null;
    }
};

export const signOutUser = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void): (() => void) => {
    return onAuthStateChanged(auth, callback);
}; 