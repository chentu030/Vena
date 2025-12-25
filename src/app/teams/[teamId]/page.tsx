'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import { getTeam, inviteMember, sendTeamMessage, TeamData, TeamMessage, getUserProjects, shareProjectWithTeam, getProjectsByIds, ProjectData } from '@/lib/firestore';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Users, Send, Mail, Briefcase, ChevronLeft, MoreVertical, Hash, UserPlus, Settings, X, Plus, Folder, Paperclip, FileText, Download, Bot, Sparkles } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { getIconComponent, getColorClasses } from '@/lib/project-utils';

const GEMINI_MODELS = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
];

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyeGIh0Dg7CKujV3HPDkx__DnyHrVrkiuqGnnow4YXhIQjA10aDifnDU9DntUFgwRTO/exec";

export default function TeamDetailPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const teamId = params?.teamId as string;

    const [team, setTeam] = useState<TeamData | null>(null);
    const [isLoadingTeam, setIsLoadingTeam] = useState(true);

    // Chat State
    const [messages, setMessages] = useState<TeamMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Invite State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Model Picker State
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [filteredModels, setFilteredModels] = useState<string[]>([]);

    // Project Picker State
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    // Share Project State
    const [showShareModal, setShowShareModal] = useState(false);
    const [myProjects, setMyProjects] = useState<ProjectData[]>([]);
    const [sharedProjects, setSharedProjects] = useState<ProjectData[]>([]);
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }
        if (user && teamId) {
            loadTeamDetails();
            subscribeToMessages();
        }
    }, [user, loading, teamId, router]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadTeamDetails = async () => {
        setIsLoadingTeam(true);
        try {
            const data = await getTeam(teamId);
            if (!data) {
                showToast("Team not found", "error");
                setTimeout(() => router.push('/teams'), 2000);
                return;
            }
            setTeam(data);

            // Load Shared Projects
            if (data.sharedProjects && data.sharedProjects.length > 0) {
                const projects = await getProjectsByIds(data.sharedProjects);
                setSharedProjects(projects);
            } else {
                setSharedProjects([]);
            }
        } catch (e) {
            console.error("Failed to load team", e);
        } finally {
            setIsLoadingTeam(false);
        }
    };

    const loadMyProjects = async () => {
        if (!user) return;
        try {
            const list = await getUserProjects(user.uid);
            setMyProjects(list);
        } catch (e) { console.error("Failed to load my projects", e); }
    };

    const handleShareModalOpen = () => {
        loadMyProjects();
        setShowShareModal(true);
    };

    const handleShareProject = async (projectId: string) => {
        if (!teamId) return;
        setIsSharing(true);
        try {
            await shareProjectWithTeam(teamId, projectId);
            await loadTeamDetails(); // Reload to update shared list
            setShowShareModal(false);
            showToast("Project shared successfully!");
        } catch (e) {
            console.error("Failed share", e);
            showToast("Failed to share project", "error");
        } finally {
            setIsSharing(false);
        }
    };

    const subscribeToMessages = () => {
        const q = query(
            collection(db, `teams/${teamId}/messages`),
            orderBy('createdAt', 'asc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMessage));
            setMessages(msgs);
        });

        return () => unsubscribe();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove the "data:*/*;base64," prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewMessage(val);

        // Check for @ trigger (Gemini models)
        const modelMatch = val.match(/@([\w-]*)$/);
        if (modelMatch) {
            const query = modelMatch[1].toLowerCase();
            const filtered = GEMINI_MODELS.filter(m => m.toLowerCase().includes(query));
            setFilteredModels(filtered);
            setShowModelPicker(filtered.length > 0);
            setShowProjectPicker(false); // Hide project picker
        } else {
            setShowModelPicker(false);
        }

        // Check for # trigger (Projects)
        const projectMatch = val.match(/#([\w\s]*)$/);
        if (projectMatch && !modelMatch) {
            const query = projectMatch[1].toLowerCase();
            const filtered = sharedProjects.filter(p => p.name.toLowerCase().includes(query));
            setFilteredProjects(filtered);
            setShowProjectPicker(filtered.length > 0);
            setShowModelPicker(false); // Hide model picker
        } else if (!projectMatch) {
            setShowProjectPicker(false);
        }
    };

    const selectModel = (model: string) => {
        // Replace the partial @mention with the full model tag
        const newValue = newMessage.replace(/@([\w-]*)$/, `@${model} `);
        setNewMessage(newValue);
        setShowModelPicker(false);
        if (fileInputRef.current) fileInputRef.current.focus();
    };

    const selectProject = (project: ProjectData) => {
        // Replace the partial #mention with the full project tag
        const newValue = newMessage.replace(/#([\w\s]*)$/, `#${project.name} `);
        setNewMessage(newValue);
        setShowProjectPicker(false);
    };

    // Render message text with styled @model and #project tags
    const renderStyledText = (text: string, isMe: boolean) => {
        if (!text) return null;

        // Pattern to match @gemini-xxx or #project-name
        const tagPattern = /(@[\w.-]+|#[\w\s]+?)(?=\s|$)/g;
        const parts: (string | React.ReactNode)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = tagPattern.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            const tag = match[0];
            const isAiTag = tag.startsWith('@');
            const isProjectTag = tag.startsWith('#');

            // For project tags, find the matching project to get its ID
            let projectId: string | null = null;
            if (isProjectTag) {
                const projectName = tag.slice(1).trim(); // Remove # and trim
                const foundProject = sharedProjects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
                if (foundProject) {
                    projectId = foundProject.id;
                }
            }

            // Get project icon and color if available
            let ProjectIcon = Folder;
            let projectColorClasses = { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
            if (isProjectTag && projectId) {
                const foundProject = sharedProjects.find(p => p.id === projectId);
                if (foundProject) {
                    ProjectIcon = getIconComponent(foundProject.icon || 'Folder');
                    projectColorClasses = getColorClasses(foundProject.color || 'green');
                }
            }

            const tagElement = (
                <span
                    key={match.index}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${isMe
                        ? 'bg-white/20 text-white'
                        : isAiTag
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : `${projectColorClasses.bg} ${projectColorClasses.text}`
                        } ${isProjectTag && projectId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    onClick={isProjectTag && projectId ? (e) => {
                        e.stopPropagation();
                        router.push(`/project/${projectId}?from=${encodeURIComponent(`/teams/${teamId}`)}`);
                    } : undefined}
                >
                    {isAiTag && <Bot size={10} />}
                    {isProjectTag && <ProjectIcon size={10} />}
                    {tag}
                </span>
            );

            parts.push(tagElement);

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !user || !team) return;

        const messageText = newMessage.trim();
        let attachments: any[] = [];

        setIsUploading(true);
        try {
            // 1. Upload File if selected
            if (selectedFile) {
                try {
                    const base64Content = await fileToBase64(selectedFile);

                    // Use text/plain to avoid complex CORS preflight issues with GAS depending on setup
                    // But usually standard POST with body works if web app is open.
                    // Using no-cors mode would fail to give us the response.
                    // We assume the GAS script is deployed correctly.

                    const res = await fetch(GAS_API_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            filename: selectedFile.name,
                            mimeType: selectedFile.type,
                            fileContent: base64Content
                        })
                    });

                    const data = await res.json();

                    if (data.status === 'success') {
                        attachments.push({
                            name: selectedFile.name,
                            url: data.url,
                            type: selectedFile.type
                        });
                    } else {
                        throw new Error(data.message || "Upload failed");
                    }
                } catch (uploadError) {
                    console.error("GAS Upload Error", uploadError);
                    showToast("Failed to upload file to Drive", "error");
                    setIsUploading(false);
                    return; // Stop sending message if upload fails
                }
            }

            // 2. Send User Message
            await sendTeamMessage(teamId, user.uid, user.displayName || user.email || 'Unknown', messageText, attachments);

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // 3. Check for Gemini Tag
            // Regex to find @gemini... (e.g., @gemini-1.5-pro or just @gemini)
            const geminiMatch = messageText.match(/@(gemini[-\w.]*)/i);
            if (geminiMatch) {
                const taggedModel = geminiMatch[1]; // e.g. "gemini-1.5-pro"
                // Clean the prompt by removing the tag
                const prompt = messageText.replace(/@(gemini[-\w.]*)/i, '').trim();

                // Determine model to use (fallback to default if tag is just @gemini)
                let modelToUse = 'gemini-2.5-flash';
                if (taggedModel.length > 7) { // longer than "@gemini"
                    // Extract the model part, removing @
                    // But user likely typed "@gemini-1.5-pro", so we assume the whole tag might be the model name or close to it.
                    // The gemini_model.txt has "gemini-3-pro-preview" etc.
                    // We try to match what they typed.
                    // If they typed "@gemini-3-pro-preview", we use "gemini-3-pro-preview".
                    // If they typed "@gemini-3", we use "gemini-3-pro-preview" (fuzzy?) No, let's just try validation.

                    // For now, strip '@' and use as model ID.
                    modelToUse = taggedModel.replace('@', '');
                }

                // If prompt is empty after stripping tag, ignore
                if (!prompt) return;

                // Call Gemini API
                // We'll show a "typing" indicator or just insert the message when ready.
                // Optimistic UI could be good, but simple is better for now.

                // Show a temporary "Thinking..." toast or state?

                try {
                    const res = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            prompt: prompt,
                            model: modelToUse,
                            task: 'chat',
                            history: [] // We could pass recent chat history context if we wanted
                        })
                    });
                    const data = await res.json();

                    if (data.text) {
                        await sendTeamMessage(teamId, 'gemini-bot', 'Gemini AI', data.text);
                    }
                } catch (geminiError) {
                    console.error("Gemini Error", geminiError);
                    await sendTeamMessage(teamId, 'gemini-bot', 'Gemini AI', "Sorry, I encountered an error processing your request.");
                }
            }

        } catch (e) {
            console.error("Failed to send message", e);
            showToast("Failed to send message", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        setIsInviting(true);
        try {
            await inviteMember(teamId, inviteEmail.trim());
            setShowInviteModal(false);
            setInviteEmail('');
            loadTeamDetails(); // Reload to see new member
            showToast("Member invited successfully!");
        } catch (e) {
            console.error("Failed invite", e);
            showToast("Failed to invite member", "error");
        } finally {
            setIsInviting(false);
        }
    };

    if (!isMounted) return null;

    if (loading || isLoadingTeam || !team) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex transition-colors duration-500 overflow-hidden">
            <Sidebar />

            <div className="flex-1 min-w-0 flex flex-col h-screen">
                {/* Header */}
                <header className="h-16 px-6 flex justify-between items-center bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-border z-30 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/teams')} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold flex items-center gap-2">
                                <Users size={18} className="text-blue-500" />
                                {team.name}
                            </h1>
                            <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 mr-4">
                            {team.members.slice(0, 5).map((m, i) => (
                                <div key={i} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-background flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300" title={m.email}>
                                    {m.email[0].toUpperCase()}
                                </div>
                            ))}
                            {team.members.length > 5 && (
                                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-background flex items-center justify-center text-xs text-muted-foreground">
                                    +{team.members.length - 5}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5"
                        >
                            <UserPlus size={14} /> Invite
                        </button>
                    </div>
                </header>

                {/* Main Content: Split View (Projects + Chat) */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left: Projects / Content (Placeholder for now) */}
                    <div className="w-1/2 border-r border-border p-6 overflow-y-auto bg-neutral-50/30 dark:bg-black/20">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                            <Briefcase size={14} />
                            Shared Projects
                        </h2>

                        <div className="space-y-4">
                            {sharedProjects.length === 0 ? (
                                <div className="p-10 text-center border-2 border-dashed border-border rounded-2xl">
                                    <Briefcase size={32} className="mx-auto text-muted-foreground opacity-50 mb-3" />
                                    <p className="text-sm text-muted-foreground mb-4">No projects shared with this team yet.</p>
                                    <button
                                        onClick={handleShareModalOpen}
                                        className="text-blue-600 hover:underline text-sm font-medium"
                                    >
                                        Share a project
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {sharedProjects.map(p => {
                                        const IconComponent = getIconComponent(p.icon || 'Folder');
                                        const colorClasses = getColorClasses(p.color || 'blue');
                                        return (
                                            <div key={p.id} onClick={() => router.push(`/project/${p.id}?from=${encodeURIComponent(`/teams/${teamId}`)}`)} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-border hover:shadow-md transition-all cursor-pointer group">
                                                <div className={`w-10 h-10 rounded-lg ${colorClasses.bg} ${colorClasses.text} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                    <IconComponent size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium truncate">{p.name}</h3>
                                                    <p className="text-xs text-muted-foreground truncate">{p.description || "No description"}</p>
                                                </div>
                                                <ChevronLeft size={16} className="text-muted-foreground rotate-180" />
                                            </div>
                                        );
                                    })}
                                    <button
                                        onClick={handleShareModalOpen}
                                        className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-blue-600 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} /> Share another project
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Member List Details */}
                        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mt-8 mb-4 flex items-center gap-2">
                            <Users size={14} />
                            Members ({team.members.length})
                        </h2>
                        <ul className="space-y-2">
                            {team.members.map((m, i) => (
                                <li key={i} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-neutral-900 border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
                                            {m.email[0].toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{m.email}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{m.role}</span>
                                        </div>
                                    </div>
                                    {m.role === 'owner' && <Settings size={14} className="text-muted-foreground" />}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: Chat */}
                    <div className="w-1/2 flex flex-col bg-white dark:bg-neutral-900">
                        <div className="p-4 border-b border-border flex items-center gap-2 shadow-sm z-10">
                            <Hash size={16} className="text-muted-foreground" />
                            <span className="font-semibold text-sm">Team Chat</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, i) => {
                                const isMe = msg.senderId === user?.uid;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-foreground rounded-bl-none'
                                            }`}>
                                            {!isMe && <div className="text-[10px] opacity-70 mb-1 flex items-center gap-1">
                                                {msg.senderId === 'gemini-bot' && <Bot size={12} />}
                                                {msg.senderName}
                                            </div>}
                                            {renderStyledText(msg.text, isMe)}
                                            {/* Attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {msg.attachments.map((att: any, idx: number) => {
                                                        const isImage = att.type?.startsWith('image/');
                                                        if (isImage) {
                                                            return (
                                                                <div key={idx} className={`-mx-4 -mb-2 ${msg.text ? 'mt-2' : '-mt-2'}`}>
                                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="block relative">
                                                                        <img
                                                                            src={att.url}
                                                                            alt={att.name}
                                                                            className={`w-full h-auto object-cover hover:opacity-95 transition-opacity ${
                                                                                // Adjust rounded corners to match the parent bubble logic
                                                                                // Parent has rounded-2xl.
                                                                                // If isMe, rounded-br-none. If !isMe, rounded-bl-none.
                                                                                // We are at the bottom of the bubble (due to -mb-2), so we need to match bottom corners.
                                                                                isMe
                                                                                    ? 'rounded-b-2xl rounded-br-none'
                                                                                    : 'rounded-b-2xl rounded-bl-none'
                                                                                } ${msg.text ? '' : 'rounded-t-2xl' /* If no text, round top too */}`}
                                                                            style={{ maxHeight: '200px' }}
                                                                        />
                                                                    </a>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 p-2 bg-black/10 dark:bg-white/10 rounded-lg text-xs hover:bg-black/20 transition-colors"
                                                                download
                                                            >
                                                                <FileText size={14} />
                                                                <span className="truncate max-w-[150px]">{att.name}</span>
                                                                <Download size={12} className="ml-auto opacity-70" />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-neutral-50/30 dark:bg-neutral-900/30">
                            {/* File Preview */}
                            {selectedFile && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-600 dark:text-blue-300">
                                    <Paperclip size={14} />
                                    <span className="truncate">{selectedFile.name}</span>
                                    <button type="button" onClick={() => setSelectedFile(null)} className="ml-auto hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            <div className="relative flex gap-2">
                                {/* Model Picker Popover */}
                                {showModelPicker && (
                                    <div className="absolute bottom-full left-12 mb-2 w-64 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in-up z-50">
                                        <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                            <Sparkles size={12} />
                                            Select AI Model
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1">
                                            {filteredModels.map(model => (
                                                <button
                                                    key={model}
                                                    type="button"
                                                    onClick={() => selectModel(model)}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                >
                                                    <Bot size={14} className="opacity-70" />
                                                    {model}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Project Picker Popover */}
                                {showProjectPicker && (
                                    <div className="absolute bottom-full left-12 mb-2 w-64 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in-up z-50">
                                        <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                            <Folder size={12} />
                                            Tag a Project
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1">
                                            {filteredProjects.map(project => (
                                                <button
                                                    key={project.id}
                                                    type="button"
                                                    onClick={() => selectProject(project)}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 transition-colors flex items-center gap-2"
                                                >
                                                    <Folder size={14} className="opacity-70" />
                                                    {project.name}
                                                </button>
                                            ))}
                                            {filteredProjects.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                                    No matching projects
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 bg-white dark:bg-neutral-800 border border-border rounded-xl text-muted-foreground hover:text-blue-600 transition-colors"
                                >
                                    <Paperclip size={20} />
                                </button>

                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={handleMessageChange}
                                        onBlur={() => setTimeout(() => setShowModelPicker(false), 200)}
                                        placeholder="Type @gemini to ask AI, or upload a file..."
                                        className="w-full pl-4 pr-12 py-3 bg-white dark:bg-neutral-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                        disabled={isUploading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-neutral-400"
                                    >
                                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Invite Member</h2>
                            <button onClick={() => setShowInviteModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleInvite} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5 ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="colleague@example.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isInviting || !inviteEmail.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isInviting && <Loader2 size={16} className="animate-spin" />}
                                Send Invite
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Share Project Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-semibold">Share Project</h2>
                            <button onClick={() => setShowShareModal(false)}><X size={18} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto min-h-0 flex-1">
                            <p className="text-sm text-muted-foreground mb-4">Select a project to share with <strong>{team?.name}</strong>. Team members will be able to view and collaborate.</p>

                            <div className="space-y-2">
                                {myProjects.map(p => {
                                    const isAlreadyShared = sharedProjects.some(sp => sp.id === p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            disabled={isAlreadyShared || isSharing}
                                            onClick={() => handleShareProject(p.id)}
                                            className="w-full text-left p-3 rounded-xl border border-border hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                <Folder size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm truncate">{p.name}</h4>
                                                <span className="text-xs text-muted-foreground">{isAlreadyShared ? 'Already Shared' : 'Share this project'}</span>
                                            </div>
                                            {!isAlreadyShared && <Plus size={16} className="text-muted-foreground group-hover:text-blue-600" />}
                                        </button>
                                    );
                                })}
                                {myProjects.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        You don't have any projects to share.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
