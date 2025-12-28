'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getTeam, inviteMember, sendTeamMessage, TeamData, TeamMessage, getUserProjects, shareProjectWithTeam, getProjectsByIds, ProjectData, removeTeamMember, updateTeamMemberRole, removeProjectFromTeam, updateMemberStatus, addTeamFile, TeamFile, removeTeamFile, TeamMember, createTeamFolder, getUserResearchGroups, getUsersByEmails, renameTeamFile, moveTeamFile, updateFolderStyle, updateTeam } from '@/lib/firestore';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { Loader2, Users, Send, Mail, Briefcase, ChevronLeft, MoreVertical, Hash, UserPlus, Settings, X, Plus, Folder, Paperclip, FileText, Download, Bot, Sparkles, Database, Trash2, Shield, MoreHorizontal, Circle, Cloud, File, ChevronRight, Search, Grid, List, FolderPlus, BookOpen, Edit2, Eye, CornerLeftUp, ArrowDown } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { getIconComponent, getColorClasses } from '@/lib/project-utils';
import { ResearchArticle, ResearchGroup } from '@/components/ResearchPanel';
import VenaliumLoading from '@/components/VenaliumLoading';
import FileChatPanel from '@/components/FileChatPanel';
import SelectionBox from '@/components/SelectionBox'; // [NEW] // [NEW]
const PdfThumbnail = dynamic(() => import('@/components/PdfThumbnail'), { ssr: false });

const FOLDER_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'gray'];
const FOLDER_ICONS = ['Folder', 'Briefcase', 'Star', 'Archive', 'BookOpen', 'Layout', 'Box', 'Cloud'];

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
    const driveInputRef = useRef<HTMLInputElement>(null);

    // Cloud Drive State
    const [files, setFiles] = useState<TeamFile[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');

    // Cloud Drive Advanced State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [folderColor, setFolderColor] = useState('blue');
    const [folderIcon, setFolderIcon] = useState('Folder');

    // Drive Actions State
    const [uploadQueue, setUploadQueue] = useState<{ id: string, name: string, progress: number, status: 'uploading' | 'completed' | 'error' }[]>([]);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [editingStyleId, setEditingStyleId] = useState<string | null>(null);

    // File Preview State
    const [previewFile, setPreviewFile] = useState<TeamFile | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [showFileChat, setShowFileChat] = useState(false); // [NEW]

    useEffect(() => {
        if (previewFile) setIsPreviewLoading(true);
    }, [previewFile]);

    // Invite State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Paper Picker State
    const [myPapers, setMyPapers] = useState<ResearchArticle[]>([]);

    // Team Rename State
    const [showRenameTeamModal, setShowRenameTeamModal] = useState(false);
    const [renameTeamName, setRenameTeamName] = useState('');
    const [filteredPapers, setFilteredPapers] = useState<ResearchArticle[]>([]);
    const [showPaperPicker, setShowPaperPicker] = useState(false);

    // Hydrate team members with user details
    useEffect(() => {
        if (!team) return;

        const hydrateMembers = async () => {
            const missingInfoEmails = team.members
                .filter(m => !m.photoURL || !m.displayName)
                .map(m => m.email);

            if (missingInfoEmails.length > 0) {
                const users = await getUsersByEmails(missingInfoEmails);
                const updatedMembers = team.members.map(m => {
                    const userDetails = users.find((u: any) => u.email === m.email);
                    if (userDetails) {
                        return {
                            ...m,
                            photoURL: userDetails.photoURL || m.photoURL,
                            displayName: userDetails.displayName || m.displayName
                        };
                    }
                    return m;
                });

                // Only update if there are changes to avoid loop
                const hasChanges = JSON.stringify(updatedMembers) !== JSON.stringify(team.members);
                if (hasChanges) {
                    setTeam(prev => prev ? { ...prev, members: updatedMembers } : null);
                }
            }
        };

        hydrateMembers();
    }, [team?.id]); // Run when team loads/id changes. We might need to run once per team load.

    useEffect(() => {
        setIsMounted(true);
        if (user) {
            getUserResearchGroups(user.uid).then(groups => {
                // Flatten all papers from all groups
                // @ts-ignore
                const allPapers = groups.flatMap((g: any) => g.papers || []);
                setMyPapers(allPapers);
            });
        }
    }, [user]);

    // Model Picker State
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [filteredModels, setFilteredModels] = useState<string[]>([]);

    // Status State
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    // Project Picker State
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Admin Popovers
    const [activeMemberMenu, setActiveMemberMenu] = useState<string | null>(null);

    // Chat Scroll State
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const isAtBottomRef = useRef(true);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isBottom = scrollHeight - scrollTop - clientHeight < 100;
        isAtBottomRef.current = isBottom;
        setShowScrollBottom(!isBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };


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
            loadFiles();
        }
    }, [user, loading, teamId, router]);

    // Scroll to bottom of chat
    useEffect(() => {
        if (isAtBottomRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
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

            // Set initial status for me if not set
            const me = data.members.find(m => m.email === user?.email);
            if (me && !me.status) {
                // Default to online if not set
                updateMemberStatus(teamId, user!.email!, 'online');
            }

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

    const loadFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const q = query(collection(db, `teams/${teamId}/files`), orderBy('uploadedAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamFile));
                setFiles(filesData);
                setIsLoadingFiles(false);
            });
            return unsubscribe; // Return unsubscribe if needed, but we usually just run this effect once
        } catch (e) {
            console.error("Error loading files", e);
            setIsLoadingFiles(false);
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

    // Admin Actions
    const handleRemoveMember = async (email: string) => {
        if (!confirm(`Remove ${email} from team?`)) return;
        try {
            await removeTeamMember(teamId, email);
            await loadTeamDetails();
            showToast("Member removed");
        } catch (e) { showToast("Failed to remove member", "error"); }
    };

    const handleUpdateRole = async (email: string, role: 'admin' | 'member') => {
        try {
            await updateTeamMemberRole(teamId, email, role);
            await loadTeamDetails();
            showToast(`Member role updated to ${role}`);
        } catch (e) { showToast("Failed to update role", "error"); }
    };

    const handleRemoveProject = async (projectId: string) => {
        if (!confirm("Unshare this project from the team?")) return;
        try {
            await removeProjectFromTeam(teamId, projectId);
            await loadTeamDetails();
            showToast("Project unshared");
        } catch (e) { showToast("Failed to unshare project", "error"); }
    };

    const handleRenameTeam = async () => {
        if (!renameTeamName.trim() || !teamId) return;
        try {
            await updateTeam(teamId, { name: renameTeamName.trim() });
            await loadTeamDetails();
            setShowRenameTeamModal(false);
            showToast("Team renamed successfully");
        } catch (e) {
            console.error(e);
            showToast("Failed to rename team", "error");
        }
    };

    // Status & Idle Logic
    const lastActivityRef = useRef<number>(Date.now());
    const isIdleRef = useRef<boolean>(false);
    const myStatusRef = useRef<string>('offline');

    // Sync Ref & Recovery
    useEffect(() => {
        if (team && user?.email) {
            const me = team.members.find(m => m.email === user.email);
            if (me?.status) {
                myStatusRef.current = me.status;

                // Active Recovery: If DB says offline/idle but I'm active locally, fix it.
                if (me.status !== 'hidden' && me.status !== 'online' && !isIdleRef.current) {
                    if (Date.now() - lastActivityRef.current < 5 * 60 * 1000) {
                        updateMemberStatus(team.id, user.email, 'online').catch(console.error);
                    }
                }
            }
        }
    }, [team, user]);

    useEffect(() => {
        if (!user?.email || !teamId) return;
        const userEmail = user.email;

        const updateStatus = (newStatus: 'online' | 'idle') => {
            if (myStatusRef.current !== 'hidden' && myStatusRef.current !== newStatus) {
                updateMemberStatus(teamId, userEmail, newStatus).catch(console.error);
            }
        };

        const handleActivity = () => {
            lastActivityRef.current = Date.now();
            if (isIdleRef.current) {
                isIdleRef.current = false;
                updateStatus('online');
            }
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);

        const interval = setInterval(() => {
            if (Date.now() - lastActivityRef.current > 5 * 60 * 1000 && !isIdleRef.current) {
                isIdleRef.current = true;
                updateStatus('idle');
            }
        }, 10000);

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            clearInterval(interval);
        };
    }, [teamId, user?.email]);

    const checkAndSetStatus = (newStatus: 'online' | 'idle') => {
        if (!user?.email || !team) return;
        const myMember = team.members.find(m => m.email === user.email);
        if (!myMember) return;

        // Only update if not hidden and status actually changed
        if (myMember.status !== 'hidden' && myMember.status !== newStatus) {
            updateMemberStatus(team.id, user.email, newStatus);
        }
    };

    const handleStatusVisibilityChange = async (visibility: 'visible' | 'hidden') => {
        if (!user?.email) return;
        try {
            if (visibility === 'hidden') {
                await updateMemberStatus(teamId, user.email, 'hidden');
            } else {
                // When showing, default to current detected state (likely online if clicking)
                await updateMemberStatus(teamId, user.email, 'online');
                lastActivityRef.current = Date.now(); // Reset activity
            }
            await loadTeamDetails(); // Force refresh to update UI immediately
            setShowStatusPicker(false);
        } catch (e) { console.error("Error updating status", e); }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-amber-500';
            case 'offline': return 'bg-neutral-400';
            case 'hidden': return 'bg-transparent border border-neutral-400';
            default: return 'bg-neutral-400';
        }
    };

    // --- Cloud Drive Logic ---

    const getBreadcrumbs = () => {
        if (!currentFolderId) return [{ id: null, name: 'Home' }];
        const path = [];
        let curr = files.find(f => f.id === currentFolderId);
        let depth = 0;
        while (curr && depth < 20) {
            path.unshift({ id: curr.id, name: curr.name });
            const parentId = curr.parentId;
            curr = files.find(f => f.id === parentId);
            depth++;
        }
        return [{ id: null, name: 'Home' }, ...path];
    };

    const getFilteredFiles = () => {
        if (searchQuery.trim()) {
            return files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return files.filter(f => f.parentId === currentFolderId);
    };

    const getDriveStats = () => {
        const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
        const fileCount = files.filter(f => f.type !== 'folder').length;
        return { totalSize, fileCount };
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim() || !user?.email || isUploading) return;
        setIsUploading(true);
        try {
            await createTeamFolder(teamId, newFolderName.trim(), currentFolderId, user.email, folderColor, folderIcon);
            setNewFolderName('');
            setFolderColor('blue');
            setFolderIcon('Folder');
            setIsCreatingFolder(false);
            showToast("Folder created");
        } catch (e) {
            showToast("Failed to create folder", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateStyle = async () => {
        if (!editingStyleId || !teamId) return;
        try {
            await updateFolderStyle(teamId, editingStyleId, folderColor, folderIcon);
            setEditingStyleId(null);
            setFolderColor('blue');
            setFolderIcon('Folder');
            showToast("Style updated", "success");
        } catch (e) {
            showToast("Failed to update style", "error");
        }
    };

    const handleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !teamId || !user) return;

        const filesToUpload = Array.from(e.target.files);

        // 動態導入 Firebase Storage 上傳函數
        const { uploadPdfToFirebase } = await import('@/lib/pdf-upload');

        // Add to queue
        const newQueueItems = filesToUpload.map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            name: f.name,
            progress: 0,
            status: 'uploading' as const
        }));
        setUploadQueue(prev => [...prev, ...newQueueItems]);

        try {
            await Promise.all(filesToUpload.map(async (file, index) => {
                const queueItem = newQueueItems[index];

                // Set initial status
                setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'uploading', progress: 10 } : item));

                try {
                    // 使用 Firebase Storage 上傳（支援大檔案）
                    const result = await uploadPdfToFirebase(
                        file,
                        `${Date.now()}_${file.name}`,
                        teamId,
                        currentFolderId || 'root',
                        (progress) => {
                            // 更新上傳進度
                            setUploadQueue(prev => prev.map(item =>
                                item.id === queueItem.id
                                    ? { ...item, progress: Math.round(progress.progress * 0.8) + 10 } // 10-90%
                                    : item
                            ));
                        }
                    );

                    if (result.success && result.downloadUrl) {
                        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, progress: 90 } : item));

                        // Save to Firestore
                        try {
                            await addTeamFile(teamId, {
                                name: file.name,
                                url: result.downloadUrl,
                                type: file.type || 'application/octet-stream',
                                size: file.size,
                                parentId: currentFolderId,
                                storagePath: result.storagePath,
                                uploadedBy: user.email!,
                                uploadedAt: new Date(),
                                color: 'blue',
                                icon: 'File'
                            });
                        } catch (firestoreError) {
                            console.error("Firestore save failed but Storage upload success:", firestoreError);
                        }

                        setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, progress: 100, status: 'completed' } : item));
                    } else {
                        throw new Error(result.error || "Firebase Storage upload failed");
                    }
                } catch (error: any) {
                    console.error("Upload error for file:", file.name, error);
                    setUploadQueue(prev => prev.map(item => item.id === queueItem.id ? { ...item, status: 'error' } : item));
                }
            }));

            showToast('Upload completed', 'success');
        } catch (error) {
            console.error("Critical upload error", error);
            showToast('Critical upload service error', 'error');
        } finally {
            if (driveInputRef.current) driveInputRef.current.value = '';
            // Clear queue after delay
            setTimeout(() => setUploadQueue([]), 5000);
        }
    };

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingId || !renameValue.trim() || !teamId) return;
        try {
            await renameTeamFile(teamId, renamingId, renameValue.trim());
            setRenamingId(null);
            setRenameValue('');
            showToast('Renamed successfully', 'success');
        } catch (error) {
            showToast('Rename failed', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteId || !teamId) return;
        try {
            // Check if folder is empty if it's a folder? 
            const item = files.find(f => f.id === deleteId);
            if (item?.type === 'folder') {
                const hasChildren = files.some(f => f.parentId === deleteId);
                if (hasChildren) {
                    showToast('Cannot delete non-empty folder', 'error');
                    setDeleteId(null);
                    return;
                }
            }
            await removeTeamFile(teamId, deleteId);
            setDeleteId(null);
            showToast('Deleted successfully', 'success');
        } catch (error) {
            showToast('Delete failed', 'error');
        }
    };

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, current: { x: number, y: number } } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ... existing helpers ...

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start selection if clicking on the background (not a file/folder/button)
        if ((e.target as HTMLElement).closest('.group') || (e.target as HTMLElement).closest('button')) {
            // If clicking an item without shift/ctrl, handle that in onClick of item (or here)
            // For now, let item onClick handle single select logic modification if needed (e.g. shift-click)
            return;
        }

        // Clear selection if not modified
        if (!e.ctrlKey && !e.shiftKey) {
            setSelectedIds(new Set());
        }

        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        setSelectionBox({
            start: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top + containerRef.current!.scrollTop },
            current: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top + containerRef.current!.scrollTop }
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!selectionBox || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - containerRect.left;
        const currentY = e.clientY - containerRect.top + containerRef.current.scrollTop;

        setSelectionBox(prev => prev ? { ...prev, current: { x: currentX, y: currentY } } : null);

        // Calculate intersections
        const startX = Math.min(selectionBox.start.x, currentX);
        const endX = Math.max(selectionBox.start.x, currentX);
        const startY = Math.min(selectionBox.start.y, currentY);
        const endY = Math.max(selectionBox.start.y, currentY);

        const newSelected = new Set(e.ctrlKey ? selectedIds : []);

        // This is a bit heavy for mouseMove, in prod use IntersectionObserver or optimize
        // For now, we iterate visible items. Ideally we track item rects.
        // A simple proximity check using data attributes or refs on items is needed.
        // Since we don't have refs for all items easily, we'll select by checking DOM elements in the box?
        // Actually, let's just assume we can get rects of children. 
        // For simplicity/performance in this iteration: We won't do real-time box selection logic *during* drag 
        // unless we have item positions. 
        // Instead: Let's do nothing here and do it on MouseUp? No, visual feedback is needed.
        // We will implement a simple "get all item elements and check overlap" approach.

        const items = containerRef.current.querySelectorAll('[data-id]');
        items.forEach(item => {
            const rect = (item as HTMLElement).getBoundingClientRect();
            // Adjust item rect to container relative coords
            const itemLeft = rect.left - containerRect.left;
            const itemTop = rect.top - containerRect.top + containerRef.current!.scrollTop;

            // Simple AABB overlap
            if (itemLeft < endX && itemLeft + rect.width > startX &&
                itemTop < endY && itemTop + rect.height > startY) {
                newSelected.add(item.getAttribute('data-id')!);
            }
        });
        setSelectedIds(newSelected);
    };

    const handleMouseUp = () => {
        setSelectionBox(null);
    };

    // Toggle selection on click
    const toggleSelection = (id: string, multi: boolean) => {
        const newSet = new Set(multi ? selectedIds : []);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) return;

        const ids = Array.from(selectedIds);
        try {
            const promises = ids.map(id => removeTeamFile(teamId, id));
            await Promise.all(promises);
            setSelectedIds(new Set());
            showToast(`${ids.length} items deleted`, "success");
        } catch (e) {
            console.error("Bulk delete failed", e);
            showToast("Failed to delete items", "error");
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        // If dragging an item NOT in selection, ensure it gets selected
        // If dragging an item IN selection, keep selection
        let dragIds = new Set(selectedIds);
        if (!dragIds.has(id)) {
            // If we clicked a new unselected item to drag, usually it becomes the only selection 
            // OR adds to selection? Standard OS behavior: if unselected, reset selection to just this one.
            dragIds = new Set([id]);
            setSelectedIds(dragIds);
        }

        e.dataTransfer.setData('application/json', JSON.stringify(Array.from(dragIds)));
        e.dataTransfer.setData('text/plain', id); // Fallback usually
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItemId(id); // Main dragged visual
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();

        const jsonIds = e.dataTransfer.getData('application/json');
        let droppedIds: string[] = [];

        try {
            droppedIds = JSON.parse(jsonIds);
        } catch {
            const singleId = e.dataTransfer.getData('text/plain');
            if (singleId) droppedIds = [singleId];
        }

        if (droppedIds.length === 0 || !teamId) return;

        // Filter out moves into self or same parent
        // Also check circles? (Moving a folder into its own child) -> Complex, skip for now or basic check

        const moves = droppedIds.filter(id => id !== targetFolderId).map(id => moveTeamFile(teamId, id, targetFolderId));

        try {
            await Promise.all(moves);
            showToast(`Moved ${droppedIds.length} items`, 'success');
            setSelectedIds(new Set()); // Clear selection
        } catch (error) {
            showToast('Move failed', 'error');
        }
        setDraggedItemId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date: any) => {
        if (!date) return '';
        try {
            // Handle Firestore Timestamp
            if (date?.toDate) return date.toDate().toLocaleDateString();
            if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
            return new Date(date).toLocaleDateString();
        } catch (e) {
            return '';
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

    // Database/Knowledge Base Options (Mock for now, or derived from projects)
    const [showDatabasePicker, setShowDatabasePicker] = useState(false);
    const [filteredDatabases, setFilteredDatabases] = useState<string[]>([]);
    const DATABASE_OPTIONS = ['Research Papers', 'Manuscripts', 'Experimental Data', 'Patents']; // Example databases

    const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewMessage(val);

        // Check for / trigger (Gemini models)
        const modelMatch = val.match(/\/([\w-]*)$/);
        if (modelMatch) {
            const query = modelMatch[1].toLowerCase();
            const filtered = GEMINI_MODELS.filter(m => m.toLowerCase().includes(query));
            setFilteredModels(filtered);
            setShowModelPicker(filtered.length > 0);
            setShowProjectPicker(false);
            setShowDatabasePicker(false);
            setShowPaperPicker(false);
            return;
        } else {
            setShowModelPicker(false);
        }

        // Check for ## trigger (Papers) - Check BEFORE #
        const paperMatch = val.match(/##([\w\s\-\.\,\:\(\)]*)$/);
        if (paperMatch) {
            const query = paperMatch[1].toLowerCase();
            const filtered = myPapers.filter(p =>
                (p.title?.toLowerCase()?.includes(query)) ||
                (p.authors?.toLowerCase()?.includes(query))
            );
            setFilteredPapers(filtered);
            setShowPaperPicker(filtered.length > 0);
            setShowProjectPicker(false);
            setShowModelPicker(false);
            setShowDatabasePicker(false);
            return;
        } else {
            setShowPaperPicker(false);
        }

        // Check for # trigger (Projects)
        const projectMatch = val.match(/#([\w\s]*)$/);
        if (projectMatch) {
            const query = projectMatch[1].toLowerCase();
            const filtered = sharedProjects.filter(p => p.name.toLowerCase().includes(query));
            setFilteredProjects(filtered);
            setShowProjectPicker(filtered.length > 0);
            setShowModelPicker(false);
            setShowDatabasePicker(false);
            setShowPaperPicker(false);
            return;
        } else {
            setShowProjectPicker(false);
        }

        // Check for @ trigger (Databases)
        const dbMatch = val.match(/@([\w\s]*)$/);
        if (dbMatch) {
            const query = dbMatch[1].toLowerCase();
            const filtered = DATABASE_OPTIONS.filter(d => d.toLowerCase().includes(query));
            setFilteredDatabases(filtered);
            setShowDatabasePicker(filtered.length > 0);
            setShowModelPicker(false);
            setShowProjectPicker(false);
            setShowPaperPicker(false);
            return;
        } else {
            setShowDatabasePicker(false);
        }
    };

    const selectModel = (model: string) => {
        const newValue = newMessage.replace(/\/([\w-]*)$/, `/${model} `);
        setNewMessage(newValue);
        setShowModelPicker(false);
        if (fileInputRef.current) fileInputRef.current.focus();
    };

    const selectProject = (project: ProjectData) => {
        const newValue = newMessage.replace(/#([\w\s]*)$/, `#${project.name} `);
        setNewMessage(newValue);
        setShowProjectPicker(false);
        if (fileInputRef.current) fileInputRef.current.focus();
    };

    const selectDatabase = (dbName: string) => {
        const newValue = newMessage.replace(/@([\w\s]*)$/, `@${dbName} `);
        setNewMessage(newValue);
        setShowDatabasePicker(false);
        if (fileInputRef.current) fileInputRef.current.focus();
    };

    const selectPaper = (paper: ResearchArticle) => {
        // Use ##Title for the reference
        const newValue = newMessage.replace(/##([\w\s\-\.\,\:\(\)]*)$/, `##${paper.title} `);
        setNewMessage(newValue);
        setShowPaperPicker(false);
        if (fileInputRef.current) fileInputRef.current.focus();
    };

    // Render message text with styled tags
    const renderStyledText = (text: string, isMe: boolean) => {
        if (!text) return null;

        // Pattern to match /gemini, @database, #project, ##paper
        // Order matters! ## before #
        const tagPattern = /(\/[\w.-]+|@[\w\s]+|##[\w\s\-\.\,\:\(\)]+|#[\w\s]+)(?=\s|$)/g;

        const parts: (string | React.ReactNode)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = tagPattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            const tag = match[0];
            const isAiTag = tag.startsWith('/');
            const isPaperTag = tag.startsWith('##');
            // If it's not ## but starts with #, it's a project
            const isProjectTag = tag.startsWith('#') && !isPaperTag;
            const isDbTag = tag.startsWith('@');

            let projectId: string | null = null;
            let paper: ResearchArticle | undefined;

            if (isProjectTag) {
                const projectName = tag.slice(1).trim();
                const foundProject = sharedProjects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
                if (foundProject) projectId = foundProject.id;
            } else if (isPaperTag) {
                const paperTitle = tag.slice(2).trim();
                // Find paper by title (this might be imprecise if titles are not unique, but UI-driven selection ensures 1:1 usually)
                paper = myPapers.find(p => p.title && p.title.toLowerCase() === paperTitle.toLowerCase());
            }

            // Styling logic
            let bgClass = '';
            let textClass = '';
            let Icon = Folder;

            if (isAiTag) {
                bgClass = 'bg-blue-100 dark:bg-blue-900/30';
                textClass = 'text-blue-600 dark:text-blue-400';
                Icon = Bot;
            } else if (isProjectTag) {
                if (projectId) {
                    const foundProject = sharedProjects.find(p => p.id === projectId);
                    const colorClasses = getColorClasses(foundProject?.color || 'green');
                    bgClass = colorClasses.bg;
                    textClass = colorClasses.text;
                    Icon = getIconComponent(foundProject?.icon || 'Folder');
                } else {
                    bgClass = 'bg-green-100 dark:bg-green-900/30';
                    textClass = 'text-green-600 dark:text-green-400';
                    Icon = Folder;
                }
            } else if (isDbTag) {
                bgClass = 'bg-purple-100 dark:bg-purple-900/30';
                textClass = 'text-purple-600 dark:text-purple-400';
                Icon = Database;
            } else if (isPaperTag) {
                bgClass = 'bg-amber-100 dark:bg-amber-900/30';
                textClass = 'text-amber-700 dark:text-amber-400';
                Icon = BookOpen;
            }

            // User overrides
            if (isMe) {
                bgClass = 'bg-white/20';
                textClass = 'text-white';
            }

            parts.push(
                <span
                    key={match.index}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium mx-0.5 ${bgClass} ${textClass} ${(isProjectTag && projectId) || (isPaperTag && paper) ? 'cursor-pointer hover:opacity-80' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isProjectTag && projectId) {
                            router.push(`/project/${projectId}?from=${encodeURIComponent(`/teams/${teamId}`)}`);
                        } else if (isPaperTag && paper?.link) {
                            window.open(paper.link, '_blank');
                        }
                    }}
                    title={isPaperTag && paper ? paper.title : undefined}
                >
                    <Icon size={10} />
                    {isPaperTag ? <span className="max-w-[150px] truncate">{tag}</span> : tag}
                </span>
            );

            lastIndex = match.index + match[0].length;
        }

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

                        // Auto-save to "聊天室資料" folder
                        let chatFolderId = files.find(f => f.name === '聊天室資料' && f.type === 'folder' && !f.parentId)?.id;

                        if (!chatFolderId) {
                            try {
                                chatFolderId = await createTeamFolder(teamId, '聊天室資料', null, user.email!, 'purple', 'Archive');
                            } catch (e) {
                                console.error("Failed to create chat folder", e);
                            }
                        }

                        if (chatFolderId) {
                            // Generate a stable file ID so chat and folder share the same comments
                            const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                            await addTeamFile(teamId, {
                                id: fileId, // Use generated ID
                                name: selectedFile.name,
                                url: data.url,
                                type: selectedFile.type,
                                size: selectedFile.size,
                                parentId: chatFolderId,
                                uploadedBy: user.email!,
                                uploadedAt: new Date(),
                                color: 'blue',
                                icon: 'File'
                            } as TeamFile);

                            attachments.push({
                                name: selectedFile.name,
                                url: data.url,
                                type: selectedFile.type,
                                size: selectedFile.size,
                                fileId: fileId // Include file ID for comment sync
                            });
                        } else {
                            // Fallback: no folder, still push attachment but without fileId
                            attachments.push({
                                name: selectedFile.name,
                                url: data.url,
                                type: selectedFile.type,
                                size: selectedFile.size
                            });
                        }
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

            // 3. Check for Gemini Slash Command
            // Regex to find /gemini... (e.g., /gemini-2.5-flash or just /gemini)
            const geminiMatch = messageText.match(/\/(gemini[-\w.]*)/i);
            if (geminiMatch) {
                const taggedModel = geminiMatch[1]; // e.g. "gemini-2.5-flash"
                // Clean the prompt by removing the slash command
                const prompt = messageText.replace(/\/(gemini[-\w.]*)/i, '').trim();

                // Determine model to use (fallback to default if tag is just /gemini)
                let modelToUse = 'gemini-2.5-flash';
                if (taggedModel.length > 6) { // longer than "gemini"
                    // Use the specified model
                    modelToUse = taggedModel;
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
                        headers: { 'Content-Type': 'application/json' },
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
                <VenaliumLoading size="large" />
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
                                {(team.members.find(m => m.email === user?.email)?.role === 'owner' || team.members.find(m => m.email === user?.email)?.role === 'admin') && (
                                    <button
                                        onClick={() => {
                                            setRenameTeamName(team.name);
                                            setShowRenameTeamModal(true);
                                        }}
                                        className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-muted-foreground transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                            </h1>
                            <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 mr-4">
                            {team.members.slice(0, 5).map((m, i) => (
                                <div
                                    key={i}
                                    className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center overflow-hidden bg-blue-100 dark:bg-blue-900 text-xs font-bold text-blue-600 dark:text-blue-300 relative group cursor-help"
                                    title={`${m.displayName || m.email.split('@')[0]} (${m.email})`}
                                >
                                    {m.photoURL ? (
                                        <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{m.email[0].toUpperCase()}</span>
                                    )}
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
                    {/* Left: Projects / Members Info */}
                    <div className="w-80 border-r border-border p-6 overflow-y-auto bg-neutral-50/30 dark:bg-black/20 flex flex-col gap-8 shrink-0">

                        {/* Status Selector (Me) */}
                        <div className="relative">
                            <button
                                onClick={() => setShowStatusPicker(!showStatusPicker)}
                                className="flex items-center gap-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors w-full"
                            >
                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(team.members.find(m => m.email === user?.email)?.status)}`} />
                                <div className="flex-1 text-left">
                                    <div className="font-medium">My Status</div>
                                    <div className="text-[10px] text-muted-foreground capitalize">
                                        {team.members.find(m => m.email === user?.email)?.status === 'hidden' ? 'Hidden' : 'Visible'}
                                    </div>
                                </div>
                                <ChevronLeft size={14} className={`transform transition-transform ${showStatusPicker ? '-rotate-90' : 'rotate-0'}`} />
                            </button>
                            {showStatusPicker && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-neutral-900 border border-border rounded-lg shadow-lg z-50 overflow-hidden p-1">
                                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                                        Status Visibility
                                    </div>
                                    <button
                                        onClick={() => handleStatusVisibilityChange('visible')}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 ${team.members.find(m => m.email === user?.email)?.status !== 'hidden' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >
                                        <Circle size={8} className="fill-green-500 text-green-500" />
                                        Show Status
                                    </button>
                                    <button
                                        onClick={() => handleStatusVisibilityChange('hidden')}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 ${team.members.find(m => m.email === user?.email)?.status === 'hidden' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                    >
                                        <Circle size={8} className="text-neutral-400" />
                                        Hide Status
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Projects Section */}
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                <Briefcase size={14} />
                                Shared Projects
                            </h2>
                            <div className="space-y-3">
                                {sharedProjects.map(p => {
                                    const IconComponent = getIconComponent(p.icon || 'Folder');
                                    const colorClasses = getColorClasses(p.color || 'blue');
                                    const isAdmin = team.members.find(m => m.email === user?.email)?.role !== 'member';

                                    return (
                                        <div key={p.id} className="group relative flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-border hover:shadow-sm transition-all">
                                            <div
                                                onClick={() => router.push(`/project/${p.id}?from=${encodeURIComponent(`/teams/${teamId}`)}`)}
                                                className={`w-9 h-9 rounded-lg ${colorClasses.bg} ${colorClasses.text} flex items-center justify-center shrink-0 cursor-pointer`}
                                            >
                                                <IconComponent size={18} />
                                            </div>
                                            <div onClick={() => router.push(`/project/${p.id}?from=${encodeURIComponent(`/teams/${teamId}`)}`)} className="flex-1 min-w-0 cursor-pointer">
                                                <h3 className="text-sm font-medium truncate">{p.name}</h3>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleRemoveProject(p.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                                                    title="Unshare Project"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={handleShareModalOpen}
                                    className="w-full py-2.5 border border-dashed border-border rounded-xl text-s text-muted-foreground hover:text-blue-600 hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} /> Share Project
                                </button>
                            </div>
                        </div>

                        {/* Members Section */}
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                <Users size={14} />
                                Members
                            </h2>
                            <div className="space-y-2">
                                {team.members.map((m, i) => {
                                    const isAdminMe = team.members.find(tm => tm.email === user?.email)?.role !== 'member'; // Owner or Admin
                                    const isMe = m.email === user?.email;
                                    const canManage = isAdminMe && !isMe; // Can't manage self here usually, or consistent rules

                                    return (
                                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors group relative">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 overflow-hidden" title={`${m.displayName || m.email.split('@')[0]}\n${m.email}`}>
                                                        {m.photoURL ? (
                                                            <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            m.email[0]
                                                        )}
                                                    </div>
                                                    {/* Status Dot */}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(m.status)}`} title={m.status || 'Offline'} />
                                                </div>
                                                <div className="truncate">
                                                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                                        {m.email.split('@')[0]}
                                                        {m.role === 'owner' && <Shield size={12} className="text-amber-500 fill-amber-500/20" />}
                                                        {m.role === 'admin' && <Shield size={12} className="text-blue-500" />}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>
                                                </div>
                                            </div>

                                            {/* Admin Controls */}
                                            {canManage && (
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveMemberMenu(activeMemberMenu === m.email ? null : m.email)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-all"
                                                    >
                                                        <MoreVertical size={14} />
                                                    </button>

                                                    {activeMemberMenu === m.email && (
                                                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-900 border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            {m.role !== 'admin' && (
                                                                <button
                                                                    onClick={() => { handleUpdateRole(m.email, 'admin'); setActiveMemberMenu(null); }}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 flex items-center gap-2"
                                                                >
                                                                    <Shield size={12} /> Make Admin
                                                                </button>
                                                            )}
                                                            {m.role === 'admin' && (
                                                                <button
                                                                    onClick={() => { handleUpdateRole(m.email, 'member'); setActiveMemberMenu(null); }}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 flex items-center gap-2"
                                                                >
                                                                    <Shield size={12} /> Remove Admin
                                                                </button>
                                                            )}
                                                            <div className="h-px bg-border my-0.5" />
                                                            <button
                                                                onClick={() => { handleRemoveMember(m.email); setActiveMemberMenu(null); }}
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
                                                            >
                                                                <Trash2 size={12} /> Remove Member
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="w-full py-2.5 mt-2 border border-dashed border-border rounded-xl text-s text-muted-foreground hover:text-purple-600 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    <UserPlus size={14} /> Invite Member
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Content Area (Chat / Files) */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 min-w-0">
                        {/* Tab Header */}
                        <div className="h-14 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md z-20">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`h-full border-b-2 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                <Hash size={16} /> Chat
                            </button>
                            <button
                                onClick={() => setActiveTab('files')}
                                className={`h-full border-b-2 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                <Folder size={16} /> Files
                            </button>
                        </div>

                        {/* Content */}
                        {activeTab === 'chat' ? (
                            <>
                                <div className="relative flex-1 min-h-0">
                                    <div className="absolute inset-0 overflow-y-auto p-4 space-y-4" ref={scrollContainerRef} onScroll={handleScroll}>
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
                                                                    // Create a TeamFile-like object for preview
                                                                    // Use fileId if available (synced with folder), otherwise fallback
                                                                    const fileForPreview = {
                                                                        id: att.fileId || `chat_${msg.id}_${idx}`,
                                                                        name: att.name,
                                                                        url: att.url,
                                                                        type: att.type || 'application/octet-stream',
                                                                        size: att.size || 0,
                                                                        uploadedAt: msg.createdAt,
                                                                        uploadedBy: msg.senderName
                                                                    } as TeamFile;

                                                                    if (isImage) {
                                                                        return (
                                                                            <div key={idx} className={`-mx-4 -mb-2 ${msg.text ? 'mt-2' : '-mt-2'} cursor-pointer`}>
                                                                                <div
                                                                                    onClick={() => { setPreviewFile(fileForPreview); setShowFileChat(true); }}
                                                                                    className="block relative group"
                                                                                >
                                                                                    <img
                                                                                        src={att.url}
                                                                                        alt={att.name}
                                                                                        className={`w-full h-auto object-cover hover:opacity-95 transition-opacity ${isMe ? 'rounded-b-2xl rounded-br-none' : 'rounded-b-2xl rounded-bl-none'
                                                                                            } ${msg.text ? '' : 'rounded-t-2xl'}`}
                                                                                        style={{ maxHeight: '200px' }}
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                                        <Eye size={24} className="text-white drop-shadow-lg" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // PDF files - show thumbnail
                                                                    const isPdf = att.type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
                                                                    if (isPdf) {
                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                onClick={() => { setPreviewFile(fileForPreview); setShowFileChat(true); }}
                                                                                className="cursor-pointer mt-2 rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow"
                                                                            >
                                                                                <div className="h-32 bg-neutral-100 dark:bg-neutral-800 relative group">
                                                                                    <PdfThumbnail url={att.url} />
                                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                                        <Eye size={24} className="text-white drop-shadow-lg" />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="p-2 bg-neutral-50 dark:bg-neutral-900 text-xs truncate flex items-center gap-2">
                                                                                    <FileText size={12} />
                                                                                    <span className="truncate">{att.name}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Other files - simple button
                                                                    return (
                                                                        <button
                                                                            key={idx}
                                                                            onClick={() => { setPreviewFile(fileForPreview); setShowFileChat(true); }}
                                                                            className="flex items-center gap-2 p-2 bg-black/10 dark:bg-white/10 rounded-lg text-xs hover:bg-black/20 transition-colors w-full text-left"
                                                                        >
                                                                            <FileText size={14} />
                                                                            <span className="truncate max-w-[150px]">{att.name}</span>
                                                                            <Eye size={12} className="ml-auto opacity-70" />
                                                                        </button>
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
                                    {showScrollBottom && (
                                        <button
                                            onClick={scrollToBottom}
                                            className="absolute bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-10 animate-fade-in-up"
                                        >
                                            <ArrowDown size={20} />
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-neutral-50/30 dark:bg-neutral-900/30">
                                    {/* File Preview */}
                                    {selectedFile && (
                                        <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-600 dark:text-blue-300">
                                            <Paperclip size={14} />
                                            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                className="ml-auto hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Popovers */}
                                    <div className="relative">
                                        {/* Model Picker */}
                                        {showModelPicker && (
                                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden z-50">
                                                <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                    <Sparkles size={12} />
                                                    Select AI Model
                                                </div>
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {filteredModels.map(m => (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => selectModel(m)}
                                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                        >
                                                            <Bot size={14} className="opacity-70" />
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Project Picker */}
                                        {showProjectPicker && (
                                            <div className="absolute bottom-full left-12 mb-2 w-64 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden z-50">
                                                <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                    <Folder size={12} />
                                                    Tag a Project
                                                </div>
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {filteredProjects.map(project => {
                                                        const ProjectIcon = getIconComponent(project.icon || 'Folder');
                                                        const colorClasses = getColorClasses(project.color || 'blue');
                                                        return (
                                                            <button
                                                                key={project.id}
                                                                type="button"
                                                                onClick={() => selectProject(project)}
                                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2 group`}
                                                            >
                                                                <div className={`w-5 h-5 rounded flex items-center justify-center ${colorClasses.bg} ${colorClasses.text} opacity-70 group-hover:opacity-100`}>
                                                                    <ProjectIcon size={12} />
                                                                </div>
                                                                {project.name}
                                                            </button>
                                                        );
                                                    })}
                                                    {filteredProjects.length === 0 && (
                                                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                                            No matching projects
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Database Picker */}
                                        {showDatabasePicker && (
                                            <div className="absolute bottom-full left-12 mb-2 w-64 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden z-50">
                                                <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                    <Database size={12} />
                                                    Select Database
                                                </div>
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {filteredDatabases.map(dbName => (
                                                        <button
                                                            key={dbName}
                                                            type="button"
                                                            onClick={() => selectDatabase(dbName)}
                                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 transition-colors flex items-center gap-2"
                                                        >
                                                            <Database size={14} className="opacity-70" />
                                                            {dbName}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Paper Picker */}
                                        {showPaperPicker && (
                                            <div className="absolute bottom-full left-12 mb-2 w-80 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl overflow-hidden z-50">
                                                <div className="p-2 border-b border-border bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                                    <BookOpen size={12} />
                                                    Select Paper
                                                </div>
                                                <div className="max-h-60 overflow-y-auto p-1">
                                                    {filteredPapers.map(paper => (
                                                        <button
                                                            key={paper.id}
                                                            type="button"
                                                            onClick={() => selectPaper(paper)}
                                                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-start gap-2 group"
                                                        >
                                                            <div className="mt-0.5 text-blue-500 opacity-70 group-hover:opacity-100">
                                                                <FileText size={14} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium truncate text-xs">{paper.title}</div>
                                                                <div className="text-[10px] text-muted-foreground truncate">{paper.authors} • {paper.year}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {filteredPapers.length === 0 && (
                                                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                                            No matching papers found.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="p-3 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            <Paperclip size={20} />
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={handleMessageChange}
                                                placeholder="Type /gemini for AI, # for project, @ for database..."
                                                className="w-full h-full px-4 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground/50"
                                                disabled={isUploading}
                                            />
                                            {isUploading && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                                            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            // Files View
                            <div className="flex-1 flex flex-col min-h-0 bg-neutral-50/30 dark:bg-black/10">
                                {/* Toolbar */}
                                <div className={`p-4 border-b border-border flex items-center justify-between gap-4 sticky top-0 z-10 shrink-0 transition-colors ${selectedIds.size > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-neutral-900'}`}>
                                    {selectedIds.size > 0 ? (
                                        <>
                                            <div className="flex items-center gap-3 animate-fade-in">
                                                <button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                                                    <X size={18} />
                                                </button>
                                                <span className="font-semibold text-sm">{selectedIds.size} Selected</span>
                                            </div>
                                            <div className="flex items-center gap-2 animate-fade-in">
                                                <button
                                                    onClick={handleBulkDelete}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                    <span className="hidden sm:inline">Delete All</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-1 overflow-hidden text-sm flex-1">
                                                {getBreadcrumbs().map((b, i, arr) => (
                                                    <React.Fragment key={b.id || 'root'}>
                                                        <button
                                                            onClick={() => setCurrentFolderId(b.id)}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={(e) => handleDrop(e, b.id || null)}
                                                            className={`hover:text-blue-500 font-medium transition-colors whitespace-nowrap ${i === arr.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}
                                                        >
                                                            {b.name}
                                                        </button>
                                                        {i < arr.length - 1 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                                                    </React.Fragment>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="relative hidden md:block">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                                    <input
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        placeholder="Search..."
                                                        className="w-32 lg:w-48 pl-8 pr-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-lg border-none focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                                                    />
                                                </div>

                                                {isCreatingFolder ? (
                                                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl p-3 w-64 z-20 animate-fade-in-up">
                                                        <form onSubmit={handleCreateFolder} className="space-y-3">
                                                            <input
                                                                value={newFolderName}
                                                                onChange={e => setNewFolderName(e.target.value)}
                                                                placeholder="Folder Name"
                                                                className="w-full px-2 py-1.5 text-sm border border-input rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                                                                autoFocus
                                                            />

                                                            {/* Color Picker */}
                                                            <div className="flex gap-1.5 flex-wrap">
                                                                {FOLDER_COLORS.map(c => {
                                                                    const colorClasses = getColorClasses(c);
                                                                    return (
                                                                        <button
                                                                            key={c}
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFolderColor(c); }}
                                                                            className={`w-5 h-5 rounded-full ${colorClasses.bg} border-2 ${folderColor === c ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Icon Picker */}
                                                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                                {FOLDER_ICONS.map(i => {
                                                                    const Icon = getIconComponent(i);
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFolderIcon(i); }}
                                                                            className={`p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${folderIcon === i ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-muted-foreground'}`}
                                                                        >
                                                                            <Icon size={16} />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex justify-end gap-2 pt-1 border-t border-border">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setIsCreatingFolder(false)}
                                                                    className="text-xs px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="submit"
                                                                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                                >
                                                                    Create
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setIsCreatingFolder(true); setNewFolderName(''); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="New Folder">
                                                        <FolderPlus size={18} />
                                                    </button>
                                                )}

                                                <button onClick={() => driveInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                                                    <Plus size={16} />
                                                    <span className="hidden sm:inline">Upload</span>
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={driveInputRef}
                                                    className="hidden"
                                                    onChange={handleDriveUpload}
                                                    multiple
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                    {isLoadingFiles ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground animate-pulse">
                                            <VenaliumLoading size="medium" className="mb-4 text-blue-500 opacity-50" />
                                            <p>Loading files...</p>
                                        </div>
                                    ) : (
                                        <div className="relative flex-1 flex flex-col h-full" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                                            <SelectionBox start={selectionBox?.start || null} current={selectionBox?.current || null} />
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
                                                {/* Upload Queue */}
                                                {uploadQueue.map(item => (
                                                    <div key={item.id} className="relative bg-white dark:bg-neutral-900 border border-border rounded-xl p-3 flex flex-col aspect-[4/5] sm:aspect-[3/4]">
                                                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                                            {item.status === 'uploading' ? <Loader2 size={32} className="animate-spin mb-2 text-blue-500" /> : <X size={32} className="text-red-500 mb-2" />}
                                                            <span className="text-xs text-center px-2 break-all line-clamp-2">{item.name}</span>
                                                        </div>
                                                        <div className="mt-2 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                            <div className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${item.progress}%` }} />
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* New Folder Button */}


                                                {/* Back Button */}
                                                {currentFolderId && (
                                                    <div
                                                        onClick={() => setCurrentFolderId(files.find(f => f.id === currentFolderId)?.parentId || null)}
                                                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-border hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer text-center text-muted-foreground hover:text-blue-500"
                                                    >
                                                        <CornerLeftUp size={32} className="mb-2" />
                                                        <span className="text-xs font-medium">Back</span>
                                                    </div>
                                                )}



                                                {/* Folders */}
                                                {getFilteredFiles().filter(f => f.type === 'folder').map(folder => {
                                                    const isRenaming = renamingId === folder.id;
                                                    const isSelected = selectedIds.has(folder.id);
                                                    const FolderIcon = getIconComponent(folder.icon || 'Folder');
                                                    const colorClasses = getColorClasses(folder.color || 'blue');

                                                    return (
                                                        <div
                                                            key={folder.id}
                                                            data-id={folder.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, folder.id)}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, folder.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.ctrlKey || e.shiftKey) {
                                                                    toggleSelection(folder.id, true);
                                                                } else {
                                                                    if (!isRenaming) setCurrentFolderId(folder.id);
                                                                }
                                                            }}
                                                            className={`group flex flex-col items-center p-4 rounded-xl border transition-all cursor-pointer text-center relative 
                                                                ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'border-transparent hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm hover:border-blue-100 dark:hover:border-blue-900'}
                                                                ${isRenaming ? 'bg-white border-blue-500 ring-2 ring-blue-500/20' : ''}`}
                                                        >
                                                            {isRenaming ? (
                                                                <form onSubmit={handleRename} className="w-full absolute inset-0 flex items-center justify-center p-2 z-10 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-xl" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        value={renameValue}
                                                                        onChange={e => setRenameValue(e.target.value)}
                                                                        className="w-full text-center text-sm bg-transparent border-b border-blue-500 outline-none pb-1"
                                                                        autoFocus
                                                                        onBlur={() => setRenamingId(null)}
                                                                    />
                                                                </form>
                                                            ) : (
                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingStyleId(folder.id); setFolderColor(folder.color || 'blue'); setFolderIcon(folder.icon || 'Folder'); }}
                                                                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-muted-foreground"
                                                                    >
                                                                        <Settings size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setDeleteId(folder.id); }}
                                                                        className="p-1 hover:bg-red-100 hover:text-red-500 rounded text-muted-foreground"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className={`w-14 h-14 mb-2 transition-transform group-hover:scale-105 flex items-center justify-center ${colorClasses.text}`}>
                                                                <FolderIcon size={48} className={colorClasses.fill} strokeWidth={1.5} />
                                                            </div>
                                                            <span className="text-sm font-medium truncate w-full px-1">{folder.name}</span>
                                                        </div>
                                                    )
                                                })}

                                                {/* Files */}
                                                {getFilteredFiles().filter(f => f.type !== 'folder').map(file => {
                                                    const isAdmin = team?.members.find(m => m.email === user?.email)?.role !== 'member';
                                                    const isRenaming = renamingId === file.id;
                                                    const isSelected = selectedIds.has(file.id);

                                                    return (
                                                        <div
                                                            key={file.id}
                                                            data-id={file.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, file.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.ctrlKey || e.shiftKey) {
                                                                    toggleSelection(file.id, true);
                                                                } else {
                                                                    setPreviewFile(file); setShowFileChat(true);
                                                                }
                                                            }}
                                                            className={`group relative border rounded-xl p-3 hover:shadow-md transition-all flex flex-col aspect-[4/5] sm:aspect-[3/4] cursor-pointer
                                                                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' : 'bg-white dark:bg-neutral-900 border-border'}
                                                            `}
                                                        >
                                                            <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center mb-3 overflow-hidden text-neutral-400 relative">
                                                                {file.type.startsWith('image/') ? (
                                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                                ) : (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) ? (
                                                                    <PdfThumbnail url={file.url || ''} />
                                                                ) : (
                                                                    <FileText size={40} />
                                                                )}

                                                                {/* Actions Overlay */}
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1.5 p-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); setPreviewFile(file); setShowFileChat(true); }} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm transition-colors" title="Preview">
                                                                        <Eye size={16} />
                                                                    </button>
                                                                    <a href={file.url} download target="_blank" onClick={(e) => e.stopPropagation()} className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm transition-colors" title="Download">
                                                                        <Download size={16} />
                                                                    </a>
                                                                    {isAdmin && (
                                                                        <>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setRenamingId(file.id); setRenameValue(file.name); }}
                                                                                className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm transition-colors"
                                                                                title="Rename"
                                                                            >
                                                                                <Settings size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setDeleteId(file.id); }}
                                                                                className="p-2 bg-white/20 hover:bg-red-500/80 text-white rounded-full backdrop-blur-sm transition-colors"
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="mt-auto relative">
                                                                {isRenaming ? (
                                                                    <form onSubmit={handleRename} className="absolute inset-x-0 bottom-0 bg-white dark:bg-neutral-900 p-1 z-20">
                                                                        <input
                                                                            value={renameValue}
                                                                            onChange={e => setRenameValue(e.target.value)}
                                                                            className="w-full text-xs border-b border-blue-500 outline-none pb-1 bg-transparent"
                                                                            autoFocus
                                                                            onBlur={() => setRenamingId(null)}
                                                                        />
                                                                    </form>
                                                                ) : (
                                                                    <>
                                                                        <h3 className="font-medium text-xs truncate mb-1" title={file.name}>{file.name}</h3>
                                                                        <div className="flex justify-between items-center text-[10px] text-muted-foreground w-full">
                                                                            <span>{formatBytes(file.size || 0)}</span>
                                                                            <span className="text-[9px] opacity-70" suppressHydrationWarning>
                                                                                {file.uploadedAt?.seconds ? new Date(file.uploadedAt.seconds * 1000).toLocaleString() : new Date(file.uploadedAt).toLocaleString()}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="mt-auto p-2 border-t border-border bg-white dark:bg-neutral-900/50 text-[11px] text-center text-muted-foreground flex justify-between px-4">
                                                <span>{getDriveStats().fileCount} items</span>
                                                <span>{formatBytes(getDriveStats().totalSize)} used</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {
                showInviteModal && (
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
                )
            }

            {/* Simple Edit Style Modal */}
            {
                editingStyleId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-neutral-900 w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-sm">Customize Folder</h3>
                                <button onClick={() => setEditingStyleId(null)}><X size={16} /></button>
                            </div>

                            {/* Color Picker */}
                            <div className="flex gap-2 flex-wrap mb-4">
                                {FOLDER_COLORS.map(c => {
                                    const colorClasses = getColorClasses(c);
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setFolderColor(c)}
                                            className={`w-6 h-6 rounded-full ${colorClasses.bg} border-2 ${folderColor === c ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Icon Picker */}
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
                                {FOLDER_ICONS.map(i => {
                                    const Icon = getIconComponent(i);
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setFolderIcon(i)}
                                            className={`p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${folderIcon === i ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-muted-foreground'}`}
                                        >
                                            <Icon size={18} />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setRenamingId(editingStyleId); setRenameValue(files.find(f => f.id === editingStyleId)?.name || ''); setEditingStyleId(null); }}
                                    className="flex-1 py-1.5 rounded-lg border border-border text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    Rename
                                </button>
                                <button
                                    onClick={handleUpdateStyle}
                                    className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirmation Modal */}
            {
                deleteId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-neutral-900 w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden border border-border animate-fade-in-up p-6">
                            <h3 className="font-bold text-lg mb-2">Delete Item?</h3>
                            <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this? This action cannot be undone.</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
                                <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors">Delete</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Upload Queue Sidebar */}
            {
                uploadQueue.length > 0 && (
                    <div className="fixed bottom-4 right-4 z-[90] w-80 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className="p-3 border-b border-border bg-neutral-50 dark:bg-neutral-800 flex justify-between items-center">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Uploads</h3>
                            <button onClick={() => setUploadQueue([])} className="hover:text-red-500"><X size={14} /></button>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                            {uploadQueue.map(item => (
                                <div key={item.id} className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 flex items-center gap-3">
                                    {item.status === 'completed' ? <Circle className="text-green-500 fill-green-500" size={12} /> :
                                        item.status === 'error' ? <Circle className="text-red-500 fill-red-500" size={12} /> :
                                            <Loader2 className="animate-spin text-blue-500" size={12} />}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="truncate flex-1 font-medium">{item.name}</span>
                                            <span className="text-muted-foreground">{item.progress}%</span>
                                        </div>
                                        <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                            <div className={`h-full ${item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-300`} style={{ width: `${item.progress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
            {/* Share Project Modal */}
            {
                showShareModal && (
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
                )
            }

            {/* Rename Team Modal */}
            {
                showRenameTeamModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border animate-scale-in">
                            <div className="p-6">
                                <h3 className="text-xl font-bold mb-4">Rename Team</h3>
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        This will rename the team in the app and the corresponding folder in Google Drive.
                                    </p>
                                    <input
                                        type="text"
                                        value={renameTeamName}
                                        onChange={(e) => setRenameTeamName(e.target.value)}
                                        className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter new team name"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={() => setShowRenameTeamModal(false)}
                                            className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleRenameTeam}
                                            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            Rename
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* File Preview Modal */}
            {
                previewFile && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setPreviewFile(null)}>
                        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden border border-border animate-scale-in flex flex-col md:flex-row relative" onClick={(e) => e.stopPropagation()}>

                            {/* Main Preview Area */}
                            <div className="flex-1 flex flex-col h-full min-w-0">
                                {/* Header */}
                                <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileText size={20} className="text-blue-500 shrink-0" />
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-semibold truncate">{previewFile.name}</h2>
                                            <p className="text-xs text-muted-foreground">{formatBytes(previewFile.size || 0)} • Uploaded <span suppressHydrationWarning>{previewFile.uploadedAt?.seconds ? new Date(previewFile.uploadedAt.seconds * 1000).toLocaleString() : new Date(previewFile.uploadedAt).toLocaleString()}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowFileChat(!showFileChat)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${showFileChat ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-neutral-100 dark:bg-neutral-800 text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                                        >
                                            <Sparkles size={14} />
                                            <span className="hidden sm:inline">Ask AI</span>
                                        </button>
                                        <a href={previewFile.url} download target="_blank" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                                            <Download size={14} /> <span className="hidden sm:inline">Download</span>
                                        </a>
                                        <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-auto flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50 relative min-h-[400px]">
                                    {isPreviewLoading && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50/80 dark:bg-neutral-800/80 backdrop-blur-sm">
                                            <VenaliumLoading size="large" />
                                        </div>
                                    )}

                                    {previewFile.type.startsWith('image/') ? (
                                        <img
                                            src={previewFile.url}
                                            alt={previewFile.name}
                                            className={`max-w-full max-h-[80vh] object-contain transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                                            onLoad={() => setIsPreviewLoading(false)}
                                        />
                                    ) : (previewFile.type === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf')) ? (
                                        <iframe
                                            src={
                                                // Firebase Storage URL 可以直接使用
                                                (previewFile.url?.includes('firebasestorage.googleapis.com') || previewFile.url?.includes('firebasestorage.app'))
                                                    ? previewFile.url
                                                    : `https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url || '')}&embedded=true`
                                            }
                                            className={`w-full h-full transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                                            title={previewFile.name}
                                            onLoad={() => setIsPreviewLoading(false)}
                                        />
                                    ) : previewFile.type.includes('word') || previewFile.type.includes('sheet') || previewFile.type.includes('presentation') || previewFile.name.match(/\.(docx?|xlsx?|pptx?)$/i) ? (
                                        <iframe
                                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url || '')}&embedded=true`}
                                            className={`w-full h-full transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                                            title={previewFile.name}
                                            onLoad={() => setIsPreviewLoading(false)}
                                        />
                                    ) : (
                                        <div className="text-center p-8">
                                            <FileText size={64} className="text-muted-foreground mx-auto mb-4" />
                                            <h3 className="text-lg font-medium mb-2">Preview not available</h3>
                                            <p className="text-sm text-muted-foreground mb-4">This file type cannot be previewed directly.</p>
                                            <a href={previewFile.url} download target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                                <Download size={16} /> Download File
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Panel */}
                            {showFileChat && (
                                <FileChatPanel file={previewFile} teamId={teamId} userId={user?.uid || ''} onClose={() => setShowFileChat(false)} />
                            )}

                        </div>
                    </div>
                )
            }
        </div>
    );
}
