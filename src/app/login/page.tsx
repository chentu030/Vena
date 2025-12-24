'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { Loader2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { signInWithGoogle, user, loading, error } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
            <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8 border border-neutral-100 dark:border-neutral-800 text-center space-y-6">
                <div className="space-y-2">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                        <LogIn size={32} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Welcome Back</h1>
                    <p className="text-neutral-500 dark:text-neutral-400">
                        Sign in to access your personal research workspace and save your progress.
                    </p>
                </div>

                <div className="pt-4">
                    <button
                        onClick={signInWithGoogle}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-xl font-medium transition-all shadow-sm hover:shadow"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Sign in with Google
                    </button>
                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}
                    <p className="mt-4 text-xs text-neutral-400">
                        By continuing, you verify that you are an authorized user.
                    </p>
                </div>
            </div>
        </div>
    );
}
