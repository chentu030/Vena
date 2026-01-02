'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Puzzle, Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';

export default function ExtensionsPage() {
    const { t } = useLanguage();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-500 flex">
            <Sidebar />

            <div className="flex-1 min-w-0">
                {/* Header matching Dashboard */}
                <header className="h-20 px-8 flex justify-between items-center bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-border sticky top-0 z-30">
                    <div className="flex-1 max-w-xl mr-8 hidden md:block">
                        {/* Placeholder for search or breadcrumbs */}
                        <div className="flex items-center text-muted-foreground">
                            <Puzzle className="mr-2" size={20} />
                            <span className="font-medium">{t('sidebar.extensions')}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && (
                            <>
                                <div className="text-sm text-right hidden sm:block">
                                    <div className="font-medium">{user.displayName || 'User'}</div>
                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                </div>
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="User"
                                        className="w-9 h-9 rounded-full border border-border"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </header>

                <main className="max-w-6xl mx-auto px-6 py-12">
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold mb-2 font-serif">{t('sidebar.extensions')}</h1>
                        <p className="text-muted-foreground">Manage and configure your research extensions.</p>
                    </div>

                    {/* Content Placeholder */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Placeholder Card 1 */}
                        <div className="p-6 rounded-2xl border border-border bg-white dark:bg-neutral-900 hover:shadow-lg transition-all hover:border-blue-500/30">
                            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">⚡</span>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Power Tools</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Advanced analysis tools for your research workflow.
                            </p>
                            <div className="inline-block px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                Coming Soon
                            </div>
                        </div>

                        {/* Placeholder Card 2 */}
                        <div className="p-6 rounded-2xl border border-border bg-white dark:bg-neutral-900 hover:shadow-lg transition-all hover:border-blue-500/30">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-4">
                                <Puzzle size={24} className="text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Marketplace</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Browse extensions created by the community.
                            </p>
                            <div className="inline-block px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                Coming Soon
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
