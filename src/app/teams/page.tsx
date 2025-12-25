'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { getUserTeams, createTeam, TeamData } from '@/lib/firestore'; // You'll need to ensure these are exported
import { Loader2, Plus, Users, Search, X, MessageSquare, Briefcase } from 'lucide-react';
import { useTheme } from 'next-themes';
import Sidebar from '@/components/Sidebar';

export default function TeamsDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { theme } = useTheme();

    const [teams, setTeams] = useState<TeamData[]>([]);
    const [isLoadingTeams, setIsLoadingTeams] = useState(true);

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }

        if (user?.email) {
            loadTeams();
        }
    }, [user, loading, router]);

    const loadTeams = async () => {
        if (!user?.email) return;
        setIsLoadingTeams(true);
        try {
            const list = await getUserTeams(user.email);
            setTeams(list);
        } catch (e) {
            console.error("Failed to load teams", e);
        } finally {
            setIsLoadingTeams(false);
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email || !teamName.trim()) return;

        setIsSubmitting(true);
        try {
            await createTeam(user.uid, user.email, teamName.trim(), teamDescription);
            setShowCreateModal(false);
            setTeamName('');
            setTeamDescription('');
            loadTeams();
        } catch (e) {
            console.error("Failed to create team", e);
            alert("Failed to create team. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-background text-foreground flex transition-colors duration-500">
            <Sidebar />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* Header */}
                <header className="h-20 px-8 flex justify-between items-center bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-border sticky top-0 z-30">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                            My Teams
                        </h1>
                        <p className="text-sm text-muted-foreground">Collaborate with your research group</p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Create Team</span>
                    </button>
                </header>

                <main className="flex-1 p-8 overflow-y-auto">
                    {isLoadingTeams ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-muted-foreground" size={32} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teams.length === 0 && (
                                <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-neutral-50/50 dark:bg-neutral-900/20">
                                    <Users size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium mb-1">No teams yet</h3>
                                    <p className="text-muted-foreground mb-6">Create a team to start collaborating!</p>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                                    >
                                        Create your first team &rarr;
                                    </button>
                                </div>
                            )}

                            {teams.map(team => (
                                <div
                                    key={team.id}
                                    onClick={() => router.push(`/teams/${team.id}`)}
                                    className="group bg-white dark:bg-neutral-900 border border-border rounded-2xl p-6 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 cursor-pointer flex flex-col h-[220px] relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Users size={100} />
                                    </div>

                                    <div className="flex items-start justify-between mb-4 z-10">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                                            <Users size={24} />
                                        </div>
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted-foreground">
                                            {team.members?.length || 0} Members
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors z-10 truncate">
                                        {team.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 z-10">
                                        {team.description || "No description provided."}
                                    </p>

                                    <div className="pt-4 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground z-10">
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase size={12} />
                                            <span>0 Projects</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                            <MessageSquare size={12} />
                                            <span>Active Chat</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-900/50">
                            <h2 className="text-xl font-semibold">Create New Team</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Team Name</label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="e.g. Quantum Research Group"
                                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Description</label>
                                <textarea
                                    value={teamDescription}
                                    onChange={(e) => setTeamDescription(e.target.value)}
                                    placeholder="What is this team about?"
                                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm min-h-[100px]"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !teamName.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                                    Create Team
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
