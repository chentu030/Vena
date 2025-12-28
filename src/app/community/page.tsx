'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark,
    Plus, TrendingUp, Clock, Award, ChevronDown, Users, Search,
    X, Link as LinkIcon, FileText, Image as ImageIcon, Loader2, Sparkles, Flame, Shield, Globe, UploadCloud, File, Trash2, Mic, Paperclip, Video, Music
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import {
    Community, CommunityPost, subscribeToPosts, subscribeToCommunities,
    createPost, votePost, createCommunity, getUserKarma, UserKarma, PostAttachment
} from '@/lib/firestore';
import { getPdfStorage } from '@/lib/firebase-storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

type SortType = 'hot' | 'new' | 'top';
type PostType = 'text' | 'link' | 'paper' | 'image' | 'video' | 'audio' | 'mixed';

export default function CommunityPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const storage = getPdfStorage();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortType>('hot');
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [showCreateCommunity, setShowCreateCommunity] = useState(false);
    const [userKarma, setUserKarma] = useState<UserKarma>({ postKarma: 0, commentKarma: 0, updatedAt: null });
    const [isLoading, setIsLoading] = useState(true);

    // Create Post Form
    const [postTitle, setPostTitle] = useState('');
    const [postContent, setPostContent] = useState('');
    const [postLink, setPostLink] = useState('');
    const [postCommunity, setPostCommunity] = useState('');

    // Multi-file state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'file' }[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachmentType, setAttachmentType] = useState<'none' | 'media' | 'file' | 'link'>('none'); // media = image/video/audio

    // Create Community Form
    const [communityName, setCommunityName] = useState('');
    const [communityDisplayName, setCommunityDisplayName] = useState('');
    const [communityDescription, setCommunityDescription] = useState('');

    useEffect(() => {
        if (!user && !loading) {
            router.push('/login');
            return;
        }

        const unsubPosts = subscribeToPosts((newPosts) => {
            let sorted = [...newPosts];
            if (sortBy === 'hot') {
                sorted.sort((a, b) => {
                    const scoreA = (a.upvotes.length - a.downvotes.length) / Math.pow((Date.now() - a.createdAt?.toDate?.()?.getTime?.() || 0) / 3600000 + 2, 1.8);
                    const scoreB = (b.upvotes.length - b.downvotes.length) / Math.pow((Date.now() - b.createdAt?.toDate?.()?.getTime?.() || 0) / 3600000 + 2, 1.8);
                    return scoreB - scoreA;
                });
            } else if (sortBy === 'top') {
                sorted.sort((a, b) => (b.upvotes.length - b.downvotes.length) - (a.upvotes.length - a.downvotes.length));
            }
            if (selectedCommunity) {
                sorted = sorted.filter(p => p.communityId === selectedCommunity);
            }
            setPosts(sorted);
            setIsLoading(false);
        }, selectedCommunity || undefined);

        const unsubCommunities = subscribeToCommunities((comms) => {
            setCommunities(comms);
        });

        if (user) {
            getUserKarma(user.uid).then(setUserKarma);
        }

        return () => {
            unsubPosts();
            unsubCommunities();
        };
    }, [user, loading, router, sortBy, selectedCommunity]);

    const handleVote = async (postId: string, voteType: 'up' | 'down') => {
        if (!user) return;
        await votePost(postId, user.uid, voteType);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);

            const newPreviews = newFiles.map(file => {
                let type: 'image' | 'video' | 'audio' | 'file' = 'file';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';

                return {
                    file,
                    preview: URL.createObjectURL(file), // Provide object URL for preview
                    type
                };
            });
            setFilePreviews(prev => [...prev, ...newPreviews]);
            if (attachmentType === 'none') setAttachmentType('media'); // Default to media/file view
        }
    };

    const triggerFileSelect = (acceptType: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = acceptType;
            fileInputRef.current.click();
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setFilePreviews(prev => {
            const newPreviews = [...prev];
            URL.revokeObjectURL(newPreviews[index].preview); // Cleanup
            return newPreviews.filter((_, i) => i !== index);
        });
    };

    const removeLink = () => {
        setPostLink('');
        if (selectedFiles.length === 0) setAttachmentType('none');
    }

    const handleCreatePost = async () => {
        if (!user || !postTitle.trim() || !postCommunity) return;
        setIsSubmitting(true);
        const community = communities.find(c => c.id === postCommunity);

        try {
            const attachments: PostAttachment[] = [];

            // Upload all files
            for (const file of selectedFiles) {
                const storagePath = `community/${postCommunity}/${Date.now()}_${uuidv4()}_${file.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(storageRef);

                let type: 'image' | 'video' | 'audio' | 'file' = 'file';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';

                attachments.push({
                    id: uuidv4(),
                    url: downloadUrl,
                    type: type,
                    name: file.name,
                    size: file.size,
                    mimeType: file.type
                });
            }

            // Determine Post Type
            let finalType: PostType = 'text';
            if (postLink && attachments.length === 0) finalType = 'link';
            else if (attachments.length > 0) {
                // Simple logic for single type or mixed
                const types = new Set(attachments.map(a => a.type));
                if (types.has('video')) finalType = 'video';
                else if (types.has('audio')) finalType = 'audio';
                else if (types.has('image')) finalType = 'image';
                else if (types.has('file')) finalType = 'paper'; // 'paper' or 'file'
                // heavy logic not needed, just metadata
                if (types.size > 1) finalType = 'mixed';
            }

            await createPost({
                communityId: postCommunity,
                communityName: community?.displayName || community?.name || 'general',
                title: postTitle,
                content: postContent,
                type: finalType,
                linkUrl: postLink || undefined,
                // Legacy fields for backward compat single image/paper
                imageUrl: attachments.find(a => a.type === 'image')?.url,
                attachments: attachments, // New field!
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                authorEmail: user.email || ''
            });

            // Cleanup
            setShowCreatePost(false);
            setPostTitle('');
            setPostContent('');
            setPostLink('');
            setSelectedFiles([]);
            setFilePreviews([]);
            setAttachmentType('none');
        } catch (error) {
            console.error('Failed to create post:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateCommunity = async () => {
        if (!user || !communityName.trim() || !communityDisplayName.trim()) return;
        setIsSubmitting(true);
        try {
            await createCommunity({
                name: communityName.toLowerCase().replace(/\s+/g, ''),
                displayName: communityDisplayName,
                description: communityDescription,
                createdBy: user.uid
            });
            setShowCreateCommunity(false);
            setCommunityName('');
            setCommunityDisplayName('');
            setCommunityDescription('');
        } catch (error) {
            console.error('Failed to create community:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return 'just now';
        const date = timestamp.toDate?.() || new Date(timestamp);
        const diff = Date.now() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
        );
    }

    // Helper to render attachments in feed
    const renderAttachments = (post: CommunityPost) => {
        const attachments = post.attachments || [];
        // Backward compatibility
        if (attachments.length === 0) {
            if (post.imageUrl) return (
                <div className="mb-4 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 max-h-[400px]">
                    <img src={post.imageUrl} alt="Post content" className="w-full h-full object-cover" />
                </div>
            );
            // PDF handling for legacy
            if (post.type === 'paper' && post.linkUrl && !post.linkUrl.startsWith('http')) {
                // It's a file url
                // Actually existing logic handles type='paper' with linkUrl
            }
            return null;
        }

        const images = attachments.filter(a => a.type === 'image');
        const videos = attachments.filter(a => a.type === 'video');
        const audios = attachments.filter(a => a.type === 'audio');
        const files = attachments.filter(a => a.type === 'file');

        return (
            <div className="space-y-4 mb-4">
                {/* Images Grid */}
                {images.length > 0 && (
                    <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {images.map(img => (
                            <img key={img.id} src={img.url} className="rounded-xl object-cover w-full max-h-[400px]" alt={img.name} />
                        ))}
                    </div>
                )}
                {/* Videos */}
                {videos.map(vid => (
                    <div key={vid.id} className="rounded-xl overflow-hidden bg-black">
                        <video src={vid.url} controls className="w-full max-h-[500px]" />
                    </div>
                ))}
                {/* Audios */}
                {audios.map(aud => (
                    <div key={aud.id} className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-500 rounded-full">
                            <Music size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium mb-1">{aud.name}</div>
                            <audio src={aud.url} controls className="w-full h-8" />
                        </div>
                    </div>
                ))}
                {/* Files */}
                {files.map(file => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 group/file">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                            <FileText size={20} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover/file:underline">
                                {file.name}
                            </div>
                            <div className="text-xs text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white dark:bg-neutral-700 rounded-lg text-xs font-medium shadow-sm hover:opacity-80"
                            onClick={e => e.stopPropagation()}
                        >
                            Download
                        </a>
                    </div>
                ))}
            </div>
        );
    };

    const currentCommunity = selectedCommunity ? communities.find(c => c.id === selectedCommunity) : null;

    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden relative font-sans">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[800px] h-[800px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-15%] w-[800px] h-[800px] bg-emerald-500/10 dark:bg-emerald-600/15 rounded-full blur-[120px]" />
                <svg className="absolute inset-0 w-full h-full opacity-[0.4]" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dotPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.5" className="fill-neutral-400 dark:fill-neutral-600" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dotPattern)" />
                </svg>
            </div>

            <Sidebar />

            <main className="flex-1 relative z-10 h-screen overflow-y-auto no-scrollbar">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="mb-8 flex items-end justify-between">
                        <div>
                            <h1 className="text-4xl font-serif font-medium tracking-tight mb-2">
                                {selectedCommunity ? (
                                    <span className="flex items-center gap-3">
                                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                                        {currentCommunity?.displayName}
                                    </span>
                                ) : (
                                    "Community"
                                )}
                            </h1>
                            <p className="text-neutral-500 dark:text-neutral-400 max-w-xl">
                                {selectedCommunity
                                    ? currentCommunity?.description || "A dedicated space for discussion."
                                    : "Connect with researchers, share insights, and discuss the latest findings."}
                            </p>
                        </div>
                        {!selectedCommunity && (
                            <button
                                onClick={() => setShowCreateCommunity(true)}
                                className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:opacity-80 transition-opacity shadow-lg"
                            >
                                + Create Community
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Main Feed */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Create Post Trigger */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md border border-white/40 dark:border-neutral-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                                onClick={() => setShowCreatePost(true)}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-emerald-50/50 dark:from-blue-900/10 dark:to-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center text-lg font-serif">
                                        {user?.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-neutral-500 dark:text-neutral-400 text-lg font-light">
                                            Share your research...
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-blue-500">
                                            <ImageIcon size={20} />
                                        </div>
                                        <div className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-emerald-500">
                                            <LinkIcon size={20} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Sort & Filter */}
                            <div className="flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                                {[
                                    { id: 'hot', label: 'Hot', icon: Flame },
                                    { id: 'new', label: 'New', icon: Clock },
                                    { id: 'top', label: 'Top', icon: Award }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSortBy(tab.id as SortType)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${sortBy === tab.id
                                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md'
                                            : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                                            }`}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Posts */}
                            <div className="space-y-4">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                                        <Loader2 className="animate-spin mb-4" size={32} />
                                        <p className="font-light tracking-wide text-sm">LOADING DISCUSSIONS...</p>
                                    </div>
                                ) : posts.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Sparkles className="text-neutral-400" size={32} />
                                        </div>
                                        <h3 className="text-xl font-serif font-medium mb-2">No discussions yet</h3>
                                        <p className="text-neutral-500 max-w-md mx-auto mb-8">
                                            Be the first to start a conversation in this community.
                                        </p>
                                        <button
                                            onClick={() => setShowCreatePost(true)}
                                            className="px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full font-medium hover:opacity-90 transition-opacity"
                                        >
                                            Start Discussion
                                        </button>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <motion.div
                                            key={post.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border border-white/40 dark:border-neutral-800 rounded-2xl p-1 overflow-hidden hover:shadow-lg transition-all duration-300"
                                        >
                                            <div className="flex h-full p-4 gap-4">
                                                {/* Votes */}
                                                <div className="flex flex-col items-center gap-1 pt-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleVote(post.id, 'up'); }}
                                                        className={`p-1 rounded-lg transition-colors ${user && post.upvotes.includes(user.uid) ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                                    >
                                                        <ArrowBigUp size={24} />
                                                    </button>
                                                    <span className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
                                                        {post.upvotes.length - post.downvotes.length}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleVote(post.id, 'down'); }}
                                                        className={`p-1 rounded-lg transition-colors ${user && post.downvotes.includes(user.uid) ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                                                    >
                                                        <ArrowBigDown size={24} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 cursor-pointer" onClick={() => router.push(`/community/post/${post.id}`)}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {post.communityName && (
                                                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400">
                                                                r/{post.communityName}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-neutral-400 font-medium">
                                                            u/{post.authorName} · {formatTime(post.createdAt)}
                                                        </span>
                                                    </div>

                                                    <h2 className="text-xl font-medium tracking-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {post.title}
                                                    </h2>

                                                    {post.content && (
                                                        <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed line-clamp-3 mb-4 font-light">
                                                            {post.content}
                                                        </p>
                                                    )}

                                                    {/* Render Attachments */}
                                                    {renderAttachments(post)}

                                                    {/* Legacy Link/File Handling if not in attachments */}
                                                    {(!post.attachments || post.attachments.length === 0) && (post.linkUrl && post.type === 'link') && (
                                                        <div className="mb-4 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-center gap-3 group/link">
                                                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center text-blue-500">
                                                                <LinkIcon size={20} />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate group-hover/link:underline">
                                                                    {post.linkUrl}
                                                                </div>
                                                                <div className="text-xs text-blue-500/70 truncate">
                                                                    {new URL(post.linkUrl).hostname}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(!post.attachments || post.attachments.length === 0) && (post.linkUrl && post.type === 'paper') && (
                                                        <div className="mb-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-3 group/file">
                                                            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                                                <FileText size={20} />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover/file:underline">
                                                                    PDF Document
                                                                </div>
                                                                <a className="text-xs text-blue-500">Download / View</a>
                                                            </div>
                                                        </div>
                                                    )}


                                                    <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                                                        <div className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-md transition-colors">
                                                            <MessageSquare size={16} />
                                                            {post.commentCount} Comments
                                                        </div>
                                                        <div className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-md transition-colors">
                                                            <Share2 size={16} />
                                                            Share
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="hidden lg:block lg:col-span-4 space-y-6">
                            {/* Trending Communities */}
                            <div className="bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md border border-white/20 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
                                <h3 className="font-serif text-lg font-medium mb-6 flex items-center gap-2">
                                    <Globe size={18} className="text-neutral-400" />
                                    Explore Communities
                                </h3>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setSelectedCommunity(null)}
                                        className={`w-full flex items-center gap-4 p-2 rounded-xl transition-all ${!selectedCommunity
                                            ? 'bg-white dark:bg-neutral-800 shadow-sm'
                                            : 'hover:bg-white/50 dark:hover:bg-neutral-800/50'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center text-white text-xs">
                                            ALL
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium text-sm">All Research</div>
                                            <div className="text-xs text-neutral-500">Global Feed</div>
                                        </div>
                                    </button>

                                    {communities.map(comm => (
                                        <button
                                            key={comm.id}
                                            onClick={() => setSelectedCommunity(comm.id)}
                                            className={`w-full flex items-center gap-4 p-2 rounded-xl transition-all ${selectedCommunity === comm.id
                                                ? 'bg-white dark:bg-neutral-800 shadow-sm'
                                                : 'hover:bg-white/50 dark:hover:bg-neutral-800/50'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-serif">
                                                {comm.displayName.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium text-sm">r/{comm.name}</div>
                                                <div className="text-xs text-neutral-500">{comm.memberCount} Scholars</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* About / Footer */}
                            <div className="px-6 py-4">
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-neutral-400 uppercase tracking-widest font-medium">
                                    <span>About</span>
                                    <span>Guidelines</span>
                                    <span>Privacy</span>
                                    <span>Terms</span>
                                </div>
                                <div className="mt-4 text-[10px] text-neutral-300 uppercase tracking-widest">
                                    Venalium © 2025
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Post Modal */}
            <AnimatePresence>
                {showCreatePost && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowCreatePost(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center relative">
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <h2 className="font-bold text-lg">Create Post</h2>
                                </div>
                                <div /> {/* Spacer */}
                                <button onClick={() => setShowCreatePost(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors z-10">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* User Info & Community Select (Inline) */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center text-sm font-serif">
                                        {user?.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{user?.displayName || 'User'}</div>
                                        <select
                                            value={postCommunity}
                                            onChange={e => setPostCommunity(e.target.value)}
                                            className="mt-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md py-1 px-2 border-none outline-none cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                        >
                                            <option value="">Select Community ▾</option>
                                            {communities.map(c => (
                                                <option key={c.id} value={c.id}>r/{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={postTitle}
                                    onChange={e => setPostTitle(e.target.value)}
                                    placeholder="Title"
                                    className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
                                />

                                <textarea
                                    value={postContent}
                                    onChange={e => setPostContent(e.target.value)}
                                    placeholder={`What's on your mind, ${user?.displayName?.split(' ')[0]}?`}
                                    className="w-full min-h-[120px] bg-transparent resize-none outline-none text-lg leading-relaxed placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                                />

                                {/* Link Input */}
                                {postLink && (
                                    <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-800 rounded-xl p-2 border border-blue-200 dark:border-blue-900/50 shadow-sm mb-2">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-500 mr-2">
                                            <LinkIcon size={20} />
                                        </div>
                                        <input
                                            type="url"
                                            value={postLink}
                                            onChange={e => setPostLink(e.target.value)}
                                            placeholder="https://"
                                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-blue-600 dark:text-blue-400"
                                        />
                                        <button onClick={removeLink} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-400">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Attachments Preview Grid */}
                                {selectedFiles.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {filePreviews.map((preview, index) => (
                                            <div key={index} className="relative group rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 aspect-square">
                                                <button
                                                    onClick={() => removeFile(index)}
                                                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-20 opacity-0 group-hover:opacity-100"
                                                >
                                                    <X size={14} />
                                                </button>

                                                {preview.type === 'image' && (
                                                    <img src={preview.preview} alt="preview" className="w-full h-full object-cover" />
                                                )}
                                                {preview.type === 'video' && (
                                                    <div className="w-full h-full flex items-center justify-center bg-black text-white">
                                                        <Video size={32} />
                                                    </div>
                                                )}
                                                {preview.type === 'audio' && (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-pink-500">
                                                        <Music size={32} />
                                                        <span className="text-xs px-2 truncate mt-2 max-w-full">{preview.file.name}</span>
                                                    </div>
                                                )}
                                                {preview.type === 'file' && (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-emerald-600">
                                                        <FileText size={32} />
                                                        <span className="text-xs px-2 truncate mt-2 max-w-full text-center">{preview.file.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add more button */}
                                        <button
                                            onClick={() => triggerFileSelect("image/*,video/*,audio/*,application/pdf")}
                                            className="flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl transition-colors text-neutral-400 hover:text-neutral-500"
                                        >
                                            <Plus size={24} />
                                            <span className="text-xs font-medium mt-1">Add</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileSelect}
                            />

                            {/* Footer / Add to Post */}
                            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
                                <div className="flex items-center justify-between p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl mb-4 shadow-sm bg-white dark:bg-neutral-900/50">
                                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 pl-1">Add to your post</span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => triggerFileSelect('image/*,video/*')}
                                            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-green-500 hover:text-green-600"
                                            title="Photo/Video"
                                        >
                                            <ImageIcon size={24} />
                                        </button>
                                        <button
                                            onClick={() => triggerFileSelect('audio/*')}
                                            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-pink-500 hover:text-pink-600"
                                            title="Audio"
                                        >
                                            <Mic size={24} />
                                        </button>
                                        <button
                                            onClick={() => triggerFileSelect('application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                                            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-red-500 hover:text-red-600"
                                            title="File/Document"
                                        >
                                            <FileText size={24} />
                                        </button>
                                        {!postLink && (
                                            <button
                                                onClick={() => setPostLink('http://')}
                                                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-blue-500 hover:text-blue-600"
                                                title="Link"
                                            >
                                                <LinkIcon size={24} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreatePost}
                                    disabled={!postTitle.trim() || !postCommunity || isSubmitting}
                                    className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                                    {isSubmitting ? 'Posting...' : 'Post'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Community Modal */}
            <AnimatePresence>
                {showCreateCommunity && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowCreateCommunity(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-3xl shadow-2xl p-8"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="font-serif text-2xl mb-6">Create Community</h2>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Name</label>
                                    <div className="flex items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                                        <span className="text-neutral-400 font-medium mr-1">r/</span>
                                        <input
                                            type="text"
                                            value={communityName}
                                            onChange={e => setCommunityName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                                            className="bg-transparent flex-1 outline-none"
                                            placeholder="name"
                                            maxLength={21}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Display Name</label>
                                    <input
                                        type="text"
                                        value={communityDisplayName}
                                        onChange={e => setCommunityDisplayName(e.target.value)}
                                        className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl outline-none"
                                        placeholder="Community Name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Description</label>
                                    <textarea
                                        value={communityDescription}
                                        onChange={e => setCommunityDescription(e.target.value)}
                                        className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl outline-none min-h-[100px] resize-none"
                                        placeholder="About this community..."
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateCommunity(false)}
                                    className="px-6 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCommunity}
                                    disabled={!communityName.trim() || !communityDisplayName.trim() || isSubmitting}
                                    className="px-8 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Community'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
