'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { getUserProjects, createProject, updateProject, deleteProject, ProjectData } from '@/lib/firestore';
import { Loader2, Plus, Folder, Trash2, LogOut, Moon, Sun, Search, X, Edit2, Tag, Globe, Lock, Compass } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ICON_OPTIONS, COLOR_OPTIONS, getIconComponent, getColorClasses } from '@/lib/project-utils';
import Sidebar from '@/components/Sidebar';
import VenaliumLoading from '@/components/VenaliumLoading';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Icon Picker State
    const [iconSearchTerm, setIconSearchTerm] = useState('');

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [projectIcon, setProjectIcon] = useState('Folder');
    const [projectColor, setProjectColor] = useState('blue');
    const [projectTags, setProjectTags] = useState<string[]>([]);
    const [isPublic, setIsPublic] = useState(false);
    const [allowPublicEditing, setAllowPublicEditing] = useState(false);
    const [tagInput, setTagInput] = useState('');

    // Smart Create State
    const [researchTopic, setResearchTopic] = useState('');
    const [isCreatingSmart, setIsCreatingSmart] = useState(false);
    const [smartCreateStatus, setSmartCreateStatus] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }

        if (user) {
            loadProjects();
        }
    }, [user, loading, router]);

    const loadProjects = async () => {
        if (!user) return;
        setIsLoadingProjects(true);
        try {
            const list = await getUserProjects(user.uid);
            setProjects(list);
        } catch (e) {
            console.error("Failed to load projects", e);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setProjectName('');
        setProjectDescription('');
        setProjectIcon('Folder');
        setProjectColor('blue');
        setProjectTags([]);
        setIsPublic(false);
        setIconSearchTerm('');
        setShowModal(true);
    };

    const openEditModal = (project: ProjectData, e: React.MouseEvent) => {
        e.stopPropagation();
        setModalMode('edit');
        setEditingId(project.id);
        setProjectName(project.name);
        setProjectDescription(project.description || '');
        setProjectIcon(project.icon || 'Folder');
        setProjectColor(project.color || 'blue');
        setProjectTags(project.tags || []);
        setIsPublic(project.isPublic || false);
        setAllowPublicEditing(project.allowPublicEditing || false); // Set new state
        setIconSearchTerm('');
        setShowModal(true);
    };



    const resetForm = () => {
        setProjectName('');
        setProjectDescription('');
        setProjectIcon('Folder');
        setProjectColor('blue');
        setProjectTags([]);
        setIsPublic(false);
        setAllowPublicEditing(false);
        setEditingId(null);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim() || !user) return;

        setIsSubmitting(true);
        try {
            if (modalMode === 'create') {
                await createProject(
                    user.uid,
                    projectName.trim(),
                    projectDescription,
                    projectIcon,
                    projectColor,
                    projectTags,
                    isPublic,
                    user.displayName || 'Anonymous',
                    user.email || '',
                    allowPublicEditing // Pass new state
                );
            } else if (modalMode === 'edit' && editingId) {
                await updateProject(user.uid, editingId, {
                    name: projectName.trim(),
                    description: projectDescription,
                    icon: projectIcon,
                    color: projectColor,
                    tags: projectTags,
                    isPublic: isPublic,
                    allowPublicEditing: allowPublicEditing // Update permission
                });
            }
            setShowModal(false);
            resetForm();
            await loadProjects();
        } catch (e) {
            console.error(`Failed to ${modalMode} project`, e);
            alert(`Failed to ${modalMode} project`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSmartCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!researchTopic.trim() || !user) return;

        setIsCreatingSmart(true);
        setSmartCreateStatus('Analyzing your research topic...');
        try {
            // Use gemini-2.5-flash for combined naming + config extraction
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    task: 'summary',
                    prompt: `Analyze this research request and extract configuration.
User Input: "${researchTopic}"

Return a JSON object with these fields:
{
    "projectName": "A short, professional project name (max 8 English words)",
    "keywords": "Academic search keywords extracted from the request",
    "languages": ["en"], // Array of language codes. Detect from request.
    "startYear": 2020, // If user mentions years, extract. Default: 2020
    "endYear": 2025, // Default: 2025
    "scopusCount": 15, // Default: 15
    "geminiCount": 15, // Default: 15
    "additionalInstructions": "" // Any extra requirements from user, e.g. "only empirical studies", "exclude review papers"
}

Language code mapping:
- English: "en"
- Traditional Chinese: "zh-TW"
- Simplified Chinese: "zh-CN"
- French: "fr"
- German: "de"
- Japanese: "ja"
- Korean: "ko"
- Spanish: "es"
- Portuguese: "pt"
- Russian: "ru"

Rules:
1. If user mentions "法文" or "French", include "fr" in languages.
2. If user mentions years like "2020-2023", set startYear=2020, endYear=2023.
3. If user input contains Chinese, also include "zh-TW" in languages.
4. projectName should be in English, concise and professional.
5. Extract extra requirements like "只要實證研究" or "exclude meta-analysis" into additionalInstructions.
6. Return ONLY valid JSON, no markdown or explanation.`,
                })
            });

            const data = await res.json();

            // Parse the response
            let config = {
                projectName: researchTopic.substring(0, 50),
                keywords: researchTopic,
                languages: ['en'] as string[],
                startYear: 2020,
                endYear: 2025,
                scopusCount: 15,
                geminiCount: 15,
                additionalInstructions: ''
            };

            if (data.text) {
                try {
                    const jsonStr = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(jsonStr);
                    config = { ...config, ...parsed };
                } catch (e) {
                    console.error("Failed to parse config JSON", e);
                }
            }

            setSmartCreateStatus('Creating your workspace...');

            // Create project with the AI-generated name
            const newProjectId = await createProject(
                user.uid,
                config.projectName,
                `Research project about: ${researchTopic}`,
                'Compass',
                'blue',
                ['research', 'smart-create'],
                false,
                user.displayName || 'Anonymous',
                user.email || '',
                false
            );

            setSmartCreateStatus('Preparing research environment...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Build the search config URL params
            const searchConfig = {
                keywords: config.keywords,
                languages: config.languages,
                startYear: config.startYear,
                endYear: config.endYear,
                scopusCount: config.scopusCount,
                geminiCount: config.geminiCount,
                additionalInstructions: config.additionalInstructions || '',
                originalMessage: researchTopic
            };

            // Redirect with full config
            if (newProjectId) {
                router.push(`/project/${newProjectId}?initialSearchConfig=${encodeURIComponent(JSON.stringify(searchConfig))}`);
            }

        } catch (error) {
            console.error("Smart create failed:", error);
            alert("Failed to create project automatically. Please try again.");
            setIsCreatingSmart(false);
            setSmartCreateStatus('');
        }
    };

    const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !confirm('Are you sure you want to delete this project? Data cannot be recovered.')) return;

        try {
            await deleteProject(user.uid, projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
        } catch (e) {
            console.error("Failed to delete project", e);
            alert("Failed to delete project");
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!projectTags.includes(tagInput.trim())) {
                setProjectTags([...projectTags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setProjectTags(tags => tags.filter(t => t !== tag));
    };

    const navigateToProject = (projectId: string) => {
        router.push(`/project/${projectId}`);
    };

    // Filter projects
    const filteredProjects = projects.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            p.tags?.some(tag => tag.toLowerCase().includes(term))
        );
    });

    // Filter icons for picker
    const filteredIcons = ICON_OPTIONS.filter(opt =>
        opt.name.toLowerCase().includes(iconSearchTerm.toLowerCase()) ||
        opt.tags?.some(t => t.toLowerCase().includes(iconSearchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-500 flex">
            <Sidebar />

            {/* Full-screen Loading Overlay for Smart Create */}
            <AnimatePresence>
                {isCreatingSmart && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-xl"
                    >
                        <VenaliumLoading size="large" />
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-8 text-lg font-medium text-neutral-600 dark:text-neutral-300"
                        >
                            {smartCreateStatus}
                        </motion.p>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="mt-2 text-sm text-muted-foreground"
                        >
                            AI is setting up your research workspace...
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 min-w-0">
                {/* Header - Remove Logo, keep search & user actions */}
                <header className="h-20 px-8 flex justify-between items-center bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-border sticky top-0 z-30">
                    {/* Search Bar - Adjusted */}
                    <div className="flex-1 max-w-xl mr-8 hidden md:block">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
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
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                        ) : null}
                        <div className={`w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold ${user.photoURL ? 'hidden' : ''}`}>
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                        </div>

                        {/* Remove SignOut button here as it is in sidebar */}
                    </div>
                </header>

                <main className="max-w-6xl mx-auto px-6 py-12">
                    {/* ... (existing main content) ... */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 font-serif">My Projects</h1>
                            <p className="text-muted-foreground">Manage your research workspaces</p>
                        </div>

                        <button
                            onClick={openCreateModal}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                        >
                            <Plus size={18} />
                            New Project
                        </button>
                    </div>

                    {/* Smart Create Input Section (New) */}
                    <div className="mb-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 p-8 md:p-12 text-center animate-fade-in shadow-sm">
                        <div className="relative z-10 max-w-2xl mx-auto">
                            <h2 className="text-2xl md:text-4xl font-serif font-medium mb-4 text-blue-900 dark:text-blue-100">
                                What do you want to research?
                            </h2>
                            <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-lg mx-auto">
                                Enter a topic and let AI set up your workspace, find relevant papers, and organize your study.
                            </p>

                            <form onSubmit={handleSmartCreate} className="relative max-w-xl mx-auto">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                                <input
                                    type="text"
                                    value={researchTopic}
                                    onChange={(e) => setResearchTopic(e.target.value)}
                                    placeholder="e.g. Biodiversity credit, High-entropy alloys..."
                                    className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-blue-100 dark:border-blue-800 bg-white/80 dark:bg-black/50 backdrop-blur-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-lg shadow-sm"
                                    disabled={isCreatingSmart}
                                />
                                {researchTopic.trim() && (
                                    <button
                                        type="submit"
                                        disabled={isCreatingSmart}
                                        className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-full font-medium transition-all flex items-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isCreatingSmart ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Setting up...
                                            </>
                                        ) : (
                                            <>
                                                Start <Compass size={16} />
                                            </>
                                        )}
                                    </button>
                                )}
                            </form>
                        </div>

                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-200/30 dark:bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                    </div>

                    {isLoadingProjects ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-muted-foreground" size={32} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProjects.length === 0 && (
                                <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-neutral-50/50 dark:bg-neutral-900/20">
                                    <Folder size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium mb-1">No projects found</h3>
                                    <p className="text-muted-foreground mb-6">Create a new project or try a different search</p>
                                </div>
                            )}

                            {filteredProjects.map(project => {
                                // ... (keep existing project card rendering) ...
                                const IconComp = getIconComponent(project.icon || 'Folder');
                                const colorClasses = getColorClasses(project.color || 'blue');

                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => navigateToProject(project.id)}
                                        className="group relative bg-white dark:bg-neutral-900 border border-border rounded-xl p-6 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-[280px]"
                                    >
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 translate-x-4 group-hover:translate-x-0 duration-300">
                                            <button
                                                onClick={(e) => openEditModal(project, e)}
                                                className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors bg-white/80 dark:bg-black/50 backdrop-blur-sm"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteProject(project.id, e)}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors bg-white/80 dark:bg-black/50 backdrop-blur-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-4 mb-3">
                                            <div className={`w-14 h-14 ${colorClasses.bg} ${colorClasses.text} rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm flex-shrink-0`}>
                                                <IconComp size={28} />
                                            </div>
                                            <div className="flex-1 min-w-0 pt-1">
                                                <h3 className={`font-semibold text-lg truncate group-hover:${colorClasses.text} transition-colors`}>
                                                    {project.name}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                                    {project.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                                                    <span>{new Date(project.updatedAt.seconds * 1000).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                                            {project.description || "No description provided."}
                                        </p>

                                        <div className="mt-auto pt-4 flex flex-wrap gap-1.5 overflow-hidden border-t border-border/50">
                                            {(project.tags || []).length > 0 ? (project.tags || []).map(tag => (
                                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted-foreground font-medium">
                                                    #{tag}
                                                </span>
                                            )) : <span className="text-[10px] text-muted-foreground/50 italic">No tags</span>}
                                        </div>

                                        <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mt-4">
                                            <div className={`h-full ${colorClasses.accent} w-0 group-hover:w-full transition-all duration-700 ease-out`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-900/50">
                            <h2 className="text-xl font-semibold">
                                {modalMode === 'create' ? 'Create New Project' : 'Edit Project'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 scrollbar-hide">
                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                {/* Header Section: Icon + Basic Info */}
                                <div className="flex flex-col sm:flex-row gap-6">
                                    <div className="flex-shrink-0 flex flex-col items-center gap-3">
                                        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center ${getColorClasses(projectColor).bg} ${getColorClasses(projectColor).text} border-2 border-transparent transition-all shadow-inner`}>
                                            {React.createElement(getIconComponent(projectIcon), { size: 48 })}
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsPublic(!isPublic)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border ${isPublic ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'}`}
                                            >
                                                {isPublic ? (<><Globe size={12} /> Public</>) : (<><Lock size={12} /> Private</>)}
                                            </button>

                                            {isPublic && (
                                                <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={allowPublicEditing}
                                                        onChange={(e) => setAllowPublicEditing(e.target.checked)}
                                                        className="rounded border-border text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                    />
                                                    可編輯
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 ml-1">Project Name</label>
                                            <input
                                                type="text"
                                                value={projectName}
                                                onChange={(e) => setProjectName(e.target.value)}
                                                placeholder="My Amazing Research..."
                                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-lg"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 ml-1">Description (Optional)</label>
                                            <textarea
                                                value={projectDescription}
                                                onChange={(e) => setProjectDescription(e.target.value)}
                                                placeholder="Briefly describe your project..."
                                                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Color Picker */}
                                    <div>
                                        <label className="block text-sm font-medium mb-3 ml-1">Color Theme</label>
                                        <div className="flex flex-wrap gap-3">
                                            {COLOR_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.name}
                                                    type="button"
                                                    onClick={() => setProjectColor(opt.name)}
                                                    className={`w-8 h-8 rounded-full ${opt.bg} ${opt.text} flex items-center justify-center transition-all ${projectColor === opt.name ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ${opt.ring}` : 'hover:scale-110'}`}
                                                >
                                                    <div className={`w-3 h-3 rounded-full ${opt.accent}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tags Input */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2 ml-1">Tags</label>
                                        <div className="flex flex-wrap gap-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-border min-h-[42px] items-center">
                                            {projectTags.map(tag => (
                                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-700 text-xs font-medium border border-border shadow-sm">
                                                    #{tag}
                                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 ml-0.5">
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleAddTag}
                                                placeholder={projectTags.length === 0 ? "Add tags..." : "Add..."}
                                                className="bg-transparent border-none outline-none text-xs min-w-[60px] flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <label className="block text-sm font-medium ml-1">Icon Library</label>
                                        <div className="relative w-48">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                                            <input
                                                type="text"
                                                placeholder="Search icons..."
                                                value={iconSearchTerm}
                                                onChange={(e) => setIconSearchTerm(e.target.value)}
                                                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[180px] overflow-y-auto p-2 bg-neutral-50/50 dark:bg-neutral-800/20 rounded-xl border border-border/50">
                                        {filteredIcons.map(opt => (
                                            <button
                                                key={opt.name}
                                                type="button"
                                                onClick={() => setProjectIcon(opt.name)}
                                                title={opt.name}
                                                className={`aspect-square rounded-xl flex items-center justify-center transition-all ${projectIcon === opt.name ? 'bg-white dark:bg-neutral-700 text-blue-500 shadow-md ring-1 ring-blue-500/20 scale-105' : 'text-muted-foreground hover:bg-white dark:hover:bg-neutral-700 hover:text-foreground hover:shadow-sm'}`}
                                            >
                                                <opt.icon size={20} />
                                            </button>
                                        ))}
                                        {filteredIcons.length === 0 && (
                                            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                                                No icons found matching "{iconSearchTerm}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 rounded-xl text-muted-foreground font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFormSubmit}
                                disabled={isSubmitting || !projectName.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                            >
                                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                {modalMode === 'create' ? 'Create Project' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}
