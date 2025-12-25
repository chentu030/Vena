import React, { useState } from 'react';
import { LayoutDashboard, Compass, Settings, LogOut, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { signOut } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuItems = [
        { name: 'My Projects', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Teams', icon: Users, path: '/teams' },
        { name: 'Explore', icon: Compass, path: '/explore' },
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

            <div className="p-4 border-t border-border">
                <button
                    onClick={() => signOut()}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors`}
                    title={isCollapsed ? "Sign Out" : ""}
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
