'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { getPublicProjects, ProjectData } from '@/lib/firestore';
import { Loader2, Folder, Search, Globe, User as UserIcon, ArrowLeft, Heart, Share2, Eye, Edit } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getIconComponent, getColorClasses, ICON_OPTIONS } from '@/lib/project-utils';
import Sidebar from '@/components/Sidebar';

export default function ExplorePage() {
    const { user, loading } = useAuth(); // Auth optional for exploring? Maybe. Let's redirect to login for consistency for now, or allow guests? User said "Public browser". Usually implies public access. But for simplicity let's require auth or handle null user gracefully.
    const router = useRouter();
    const { theme } = useTheme();

    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadPublicProjects();
    }, []);

    const loadPublicProjects = async () => {
        setIsLoading(true);
        try {
            const list = await getPublicProjects();
            setProjects(list);
        } catch (e) {
            console.error("Failed to load public projects", e);
        } finally {
            setIsLoading(false);
        }
    };

    const navigateToProject = (project: ProjectData) => {
        // We pass the ownerId so the workspace knows where to fetch data
        router.push(`/project/${project.id}?ownerId=${project.userId}`);
    };

    // Filter projects
    const filteredProjects = projects.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            p.tags?.some(tag => tag.toLowerCase().includes(term)) ||
            p.description?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-500 flex">
            <Sidebar />

            <div className="flex-1 min-w-0">
                {/* Header */}
                <header className="h-20 px-8 flex justify-between items-center bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-border sticky top-0 z-50">
                    <div className="flex items-center space-x-4">
                        {/* Removed Back button as Sidebar handles nav */}
                        <div className="flex items-center space-x-3">
                            <span className="text-xl font-bold tracking-tight font-serif">Community Explore</span>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-xl mx-8 hidden md:block">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search public projects, tags, or descriptions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block">
                                    <span className="text-xs text-muted-foreground block">Logged in as</span>
                                    <span className="text-sm font-medium">{user.displayName || user.email}</span>
                                </div>
                                {user.photoURL ? (
                                    <img src={user.photoURL} className="w-9 h-9 rounded-full border border-border" alt="Me" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white">{user.email?.[0].toUpperCase()}</div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => router.push('/login')} className="text-sm font-medium hover:text-blue-500">Login</button>
                        )}
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-6 py-12">
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl font-bold mb-4 font-serif">Discover Community Research</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Browse public knowledge bases, research maps, and paper collections shared by the Venalium community.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-muted-foreground" size={32} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredProjects.length === 0 && (
                                <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-neutral-50/50 dark:bg-neutral-900/20">
                                    <Globe size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium mb-1">No public projects yet</h3>
                                    <p className="text-muted-foreground mb-6">Be the first to share your research with the world!</p>
                                </div>
                            )}

                            {filteredProjects.map(project => {
                                const IconComp = getIconComponent(project.icon || 'Folder');
                                const colorClasses = getColorClasses(project.color || 'blue');

                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => navigateToProject(project)}
                                        className="group relative bg-white dark:bg-neutral-900 border border-border rounded-xl p-6 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-[320px]"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-12 h-12 ${colorClasses.bg} ${colorClasses.text} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm flex-shrink-0`}>
                                                <IconComp size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <div className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-muted-foreground overflow-hidden">
                                                        <UserIcon size={12} />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground truncate opacity-70">
                                                        {project.authorDisplayName || project.authorEmail || `User ${project.userId.slice(0, 4)}`}
                                                    </span>
                                                    {/* Edit Mode Badge */}
                                                    {project.allowPublicEditing ? (
                                                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5">
                                                            <Edit size={10} /> 可編輯
                                                        </span>
                                                    ) : (
                                                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                                                            <Eye size={10} /> 唯讀
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className={`font-semibold text-lg truncate group-hover:${colorClasses.text} transition-colors`}>
                                                    {project.name}
                                                </h3>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-4 mb-4 flex-1">
                                            {project.description || "No description provided."}
                                        </p>

                                        <div className="mt-auto pt-4 flex flex-wrap gap-1.5 overflow-hidden border-t border-border/50">
                                            {(project.tags || []).slice(0, 4).map(tag => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted-foreground font-medium">
                                                    #{tag}
                                                </span>
                                            ))}
                                            {(project.tags?.length || 0) > 4 && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted-foreground font-medium">
                                                    +{(project.tags?.length || 0) - 4}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-2 text-xs text-muted-foreground">
                                            <span>{new Date(project.updatedAt.seconds * 1000).toLocaleDateString()}</span>
                                            <div className="flex gap-2">
                                                <Share2 size={14} className="hover:text-foreground" />
                                                {/* Could add Like count here later */}
                                            </div>
                                        </div>

                                        <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mt-3 absolute bottom-0 left-0 right-0 rounded-none">
                                            <div className={`h-full ${colorClasses.accent} w-0 group-hover:w-full transition-all duration-700 ease-out`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
