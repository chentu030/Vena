'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
            <Sidebar />
            <main className="flex-1 p-8">
                <h1 className="text-3xl font-serif font-bold mb-6">Settings</h1>
                <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                    <p className="text-neutral-500">Settings coming soon...</p>
                </div>
            </main>
        </div>
    );
}
