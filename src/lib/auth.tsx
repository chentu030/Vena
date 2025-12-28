'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    signInWithGoogle: async () => { },
    signOut: async () => { },
    clearError: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth,
            (user) => {
                setUser(user);
                setLoading(false);
            },
            (err: any) => {
                console.error("Auth State Check Error", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
            router.push('/'); // Redirect to home after login
        } catch (error: any) {
            console.error("Login Failed", error);
            // Suppress benign popup cancellation errors
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                return;
            }
            setError(error.message || 'Login failed');
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            router.push('/login');
        } catch (error: any) {
            console.error("Logout Failed", error);
            setError(error.message);
        }
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut, clearError }}>
            {children}
        </AuthContext.Provider>
    );
};
