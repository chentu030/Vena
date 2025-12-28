
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { DotPatternBackground } from '@/components/ui/dot-pattern-background';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const { signInWithGoogle, user, loading, error } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <DotPatternBackground className="flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-12 h-12 border-4 border-neutral-400 border-t-neutral-800 rounded-full animate-spin"></div>
                    <span className="text-neutral-600 font-serif italic text-sm tracking-widest">Loading Venalium...</span>
                </motion.div>
            </DotPatternBackground>
        );
    }

    return (
        <DotPatternBackground>
            <motion.div
                initial={{ opacity: 0.0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                    delay: 0.3,
                    duration: 0.8,
                    ease: "easeInOut",
                }}
                className="relative flex flex-col gap-4 items-center justify-center px-4"
            >
                {/* Brand Identity */}
                <div className="text-center space-y-4 mb-8">
                    <h1 className="text-7xl md:text-9xl font-serif tracking-tighter font-medium text-neutral-900 leading-none dark:text-white drop-shadow-sm">
                        Venalium<span className="text-blue-600">.</span>
                    </h1>
                    <div className="flex items-center justify-center gap-4 text-xs font-medium tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400">
                        <span>Research</span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                        <span>Intelligence</span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                        <span>Future</span>
                    </div>
                </div>

                {/* Login Card */}
                <div className="w-full max-w-sm bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl rounded-3xl p-8 flex flex-col gap-6 transition-all hover:shadow-2xl hover:scale-[1.01] duration-500 ring-1 ring-black/5">
                    <div className="space-y-2 text-center">
                        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">Welcome Back</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                            Access your research capabilities
                        </p>
                    </div>

                    <button
                        onClick={signInWithGoogle}
                        className="w-full h-12 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-xl transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                        <svg className="w-5 h-5 transition-transform group-hover:scale-110 duration-300" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="font-medium">Sign in with Google</span>
                    </button>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs font-medium border border-red-100 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-neutral-400 font-medium tracking-[0.5em] uppercase hover:text-neutral-600 transition-colors cursor-default">
                        EST. 2025
                    </p>
                </div>
            </motion.div>
        </DotPatternBackground>
    );
}
