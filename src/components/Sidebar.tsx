'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Compass, Settings, LogOut, ChevronLeft, ChevronRight, Users, MessageSquare, Sun, Moon, Home, Globe } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/context/LanguageContext';

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    const menuItems = [
        { name: t('sidebar.home'), icon: Home, path: '/' },
        { name: t('sidebar.myProjects'), icon: LayoutDashboard, path: '/dashboard' },
        { name: t('sidebar.teams'), icon: Users, path: '/teams' },
        { name: t('sidebar.community'), icon: Globe, path: '/community' },
        { name: t('sidebar.explore'), icon: Compass, path: '/explore' },
    ];

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen sticky top-0 bg-white dark:bg-neutral-900 border-r border-border flex flex-col z-40 transition-all duration-300 flex-shrink-0`}
        >
            <div className={`h-20 flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} border-b border-border transition-all`}>
                <img src="/venalium_logo.png" alt="Venalium" className="w-8 h-8 rounded-lg" />
                {!isCollapsed && <span className="font-bold text-lg font-serif ml-3 transition-opacity">Venalium</span>}
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <button
                            key={item.path}
                            onClick={() => router.push(item.path)}
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl transition-all font-medium ${isActive
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground'
                                }`}
                            title={isCollapsed ? item.name : ''}
                        >
                            <item.icon size={20} />
                            {!isCollapsed && <span>{item.name}</span>}
                        </button>
                    );
                })}


            </nav>

            <div className="px-4 pb-2 flex justify-end">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            <div className="p-4 border-t border-border space-y-2">
                <button
                    onClick={() => router.push('/feedback')}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors`}
                    title={isCollapsed ? t('sidebar.feedback') : ""}
                >
                    <MessageSquare size={20} />
                    {!isCollapsed && <span>{t('sidebar.feedback')}</span>}
                </button>
                <button
                    onClick={() => router.push('/settings')}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors`}
                    title={isCollapsed ? t('sidebar.settings') : ""}
                >
                    <Settings size={20} />
                    {!isCollapsed && <span>{t('sidebar.settings')}</span>}
                </button>
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors`}
                    title={isCollapsed ? (theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')) : ""}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    {!isCollapsed && <span>{theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>}
                </button>
                <button
                    onClick={() => signOut()}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors`}
                    title={isCollapsed ? t('sidebar.signOut') : ""}
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span>{t('sidebar.signOut')}</span>}
                </button>
            </div>
        </aside>
    );
}
