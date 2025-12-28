'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark,
    Plus, TrendingUp, Clock, Award, ChevronDown, Users, Search,
    X, Link as LinkIcon, FileText, Image as ImageIcon, Loader2, Sparkles, Flame, Shield
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import {
    Community, CommunityPost, subscribeToPosts, subscribeToCommunities,
    createPost, votePost, createCommunity, getUserKarma, UserKarma
} from '@/lib/firestore';

type SortType = 'hot' | 'new' | 'top';
type PostType = 'text' | 'link' | 'paper' | 'image';

export default function CommunityPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
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
    const [postType, setPostType] = useState<PostType>('text');
    const [postLink, setPostLink] = useState('');
    const [postCommunity, setPostCommunity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            // Sort posts based on sortBy
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
            // Filter by community if selected
            if (selectedCommunity) {
                sorted = sorted.filter(p => p.communityId === selectedCommunity);
            }
            setPosts(sorted);
            setIsLoading(false);
        }, selectedCommunity || undefined);

        const unsubCommunities = subscribeToCommunities((comms) => {
            setCommunities(comms);
        });

        // Get user karma
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

    const handleCreatePost = async () => {
        if (!user || !postTitle.trim() || !postCommunity) return;
        setIsSubmitting(true);

        const community = communities.find(c => c.id === postCommunity);

        try {
            await createPost({
                communityId: postCommunity,
                communityName: community?.displayName || community?.name || 'general',
                title: postTitle,
                content: postContent,
                type: postType,
                linkUrl: postType === 'link' ? postLink : undefined,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                authorEmail: user.email || ''
            });

            setShowCreatePost(false);
            setPostTitle('');
            setPostContent('');
            setPostLink('');
            setPostType('text');
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
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const currentCommunity = selectedCommunity ? communities.find(c => c.id === selectedCommunity) : null;

    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950/50">
            <Sidebar />

            <main className="flex-1">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white pt-8 pb-16 px-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pattern-dots"></div>
                    <div className="max-w-6xl mx-auto relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-2xl"
                        >
                            <h1 className="text-4xl font-bold mb-3 tracking-tight">
                                {selectedCommunity ? `Welcome to r/${currentCommunity?.displayName}` : "Welcome to the Community"}
                            </h1>
                            <p className="text-blue-100 text-lg mb-6">
                                {selectedCommunity
                                    ? currentCommunity?.description || "A place for like-minded people."
                                    : "Discover the latest research, share insights, and connect with fellow scholars."}
                            </p>
                            {!selectedCommunity && (
                                <button
                                    onClick={() => setShowCreateCommunity(true)}
                                    className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
                                >
                                    + Create Community
                                </button>
                            )}
                        </motion.div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-8 relative z-20 flex gap-6 pb-12">
                    {/* Main Feed */}
                    <div className="flex-1 space-y-4">
                        {/* Create Post Input */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border p-4"
                        >
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
                                    {user?.displayName?.charAt(0) || 'U'}
                                </div>
                                <div className="flex-1">
                                    <button
                                        onClick={() => setShowCreatePost(true)}
                                        className="w-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg px-4 py-2.5 text-left text-muted-foreground transition-colors mb-2"
                                    >
                                        What's on your mind?
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowCreatePost(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-blue-500 transition-colors"
                                        >
                                            <ImageIcon size={18} />
                                            <span>Media</span>
                                        </button>
                                        <button
                                            onClick={() => setShowCreatePost(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-blue-500 transition-colors"
                                        >
                                            <LinkIcon size={18} />
                                            <span>Link</span>
                                        </button>
                                        <button
                                            onClick={() => setShowCreatePost(true)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-blue-500 transition-colors"
                                        >
                                            <FileText size={18} />
                                            <span>Article</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Sort Tabs with Sticky Header */}
                        <div className="sticky top-[4.5rem] z-30 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur py-2">
                            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border p-1.5 flex items-center gap-1 inline-flex">
                                {[
                                    { id: 'hot', icon: Flame, label: 'Hot' },
                                    { id: 'new', icon: Clock, label: 'New' },
                                    { id: 'top', icon: Award, label: 'Top' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSortBy(tab.id as SortType)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${sortBy === tab.id
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm'
                                            : 'text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        <tab.icon size={16} className={sortBy === tab.id ? "fill-current" : ""} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Posts Feed */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                <Loader2 className="animate-spin text-blue-500" size={40} />
                                <p className="text-muted-foreground">Loading discussions...</p>
                            </div>
                        ) : posts.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border p-12 text-center"
                            >
                                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <MessageSquare className="text-blue-500" size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-2">It's quiet in here</h3>
                                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                    {selectedCommunity
                                        ? "This community hasn't had any posts yet. Why not start the conversation?"
                                        : "Your feed is empty. Explore communities or create a new post to get started!"}
                                </p>
                                <button
                                    onClick={() => setShowCreatePost(true)}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/20"
                                >
                                    Start a Discussion
                                </button>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post, idx) => {
                                    const score = post.upvotes.length - post.downvotes.length;
                                    const hasUpvoted = user && post.upvotes.includes(user.uid);
                                    const hasDownvoted = user && post.downvotes.includes(user.uid);

                                    return (
                                        <motion.div
                                            key={post.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all overflow-hidden group"
                                        >
                                            <div className="flex">
                                                {/* Vote Column */}
                                                <div className="w-12 bg-neutral-50 dark:bg-neutral-950/30 flex flex-col items-center py-3 gap-1 border-r border-transparent group-hover:border-border/50 transition-colors">
                                                    <button
                                                        onClick={() => handleVote(post.id, 'up')}
                                                        className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasUpvoted ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-muted-foreground'}`}
                                                    >
                                                        <ArrowBigUp size={24} fill={hasUpvoted ? 'currentColor' : 'none'} />
                                                    </button>
                                                    <span className={`font-bold text-sm my-1 ${hasUpvoted ? 'text-orange-500' : hasDownvoted ? 'text-blue-500' : ''}`}>
                                                        {score}
                                                    </span>
                                                    <button
                                                        onClick={() => handleVote(post.id, 'down')}
                                                        className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasDownvoted ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-muted-foreground'}`}
                                                    >
                                                        <ArrowBigDown size={24} fill={hasDownvoted ? 'currentColor' : 'none'} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 p-4">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                        {post.communityName && (
                                                            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[8px] text-white font-bold">
                                                                    {post.communityName.charAt(0)}
                                                                </div>
                                                                <span className="font-medium text-foreground">
                                                                    r/{post.communityName}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                                                        <span>Posted by u/{post.authorName}</span>
                                                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                                                        <span>{formatTime(post.createdAt)}</span>
                                                    </div>

                                                    <h2
                                                        className="text-lg font-semibold mb-2 hover:text-blue-600 cursor-pointer text-foreground"
                                                        onClick={() => router.push(`/community/post/${post.id}`)}
                                                    >
                                                        {post.title}
                                                    </h2>

                                                    {post.content && (
                                                        <p
                                                            className="text-muted-foreground mb-3 line-clamp-3 text-sm leading-relaxed cursor-pointer"
                                                            onClick={() => router.push(`/community/post/${post.id}`)}
                                                        >
                                                            {post.content}
                                                        </p>
                                                    )}

                                                    {/* Link Preview (Simple) */}
                                                    {post.linkUrl && (
                                                        <a
                                                            href={post.linkUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block mb-4 group/link"
                                                        >
                                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 hover:border-blue-300 transition-colors">
                                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                                                                    <LinkIcon size={20} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium truncate text-blue-700 dark:text-blue-300 group-hover/link:underline">
                                                                        {post.linkUrl}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        {new URL(post.linkUrl).hostname}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </a>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 text-muted-foreground mt-2">
                                                        <button
                                                            onClick={() => router.push(`/community/post/${post.id}`)}
                                                            className="flex items-center gap-2 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors"
                                                        >
                                                            <MessageSquare size={16} />
                                                            {post.commentCount} Comments
                                                        </button>
                                                        <button className="flex items-center gap-2 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                                                            <Share2 size={16} />
                                                            Share
                                                        </button>
                                                        <button className="flex items-center gap-2 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                                                            <Bookmark size={16} />
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar */}
                    <div className="hidden lg:block w-80 space-y-6">
                        {/* About / Rules Card - Reddit Style */}
                        {selectedCommunity && currentCommunity && (
                            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border overflow-hidden">
                                <div className="p-3 bg-blue-600 text-white font-medium flex items-center gap-2">
                                    <Shield size={16} />
                                    About Community
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
                                            {currentCommunity.displayName.charAt(0)}
                                        </div>
                                        <div className="font-semibold text-lg">r/{currentCommunity.name}</div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {currentCommunity.description}
                                    </p>
                                    <div className="flex gap-4 pt-2 border-t border-border">
                                        <div>
                                            <div className="font-bold text-lg">{currentCommunity.memberCount}</div>
                                            <div className="text-xs text-muted-foreground">Members</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg text-green-500">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                    Online
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">Status</div>
                                        </div>
                                    </div>
                                    <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors">
                                        Join Community
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Trending / Active Communities */}
                        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border overflow-hidden">
                            <div className="p-4 border-b border-border">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <TrendingUp size={16} className="text-blue-500" />
                                    Trending Communities
                                </h3>
                            </div>
                            <div className="divide-y divide-border">
                                <button
                                    onClick={() => setSelectedCommunity(null)}
                                    className={`w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3 ${!selectedCommunity ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm shadow-md shadow-orange-500/20">
                                        🌐
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">All Communities</div>
                                        <div className="text-xs text-muted-foreground">Global Feed</div>
                                    </div>
                                </button>
                                {communities.slice(0, 5).map(comm => (
                                    <button
                                        key={comm.id}
                                        onClick={() => setSelectedCommunity(comm.id)}
                                        className={`w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3 ${selectedCommunity === comm.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20">
                                            {comm.displayName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">r/{comm.name}</div>
                                            <div className="text-xs text-muted-foreground">{comm.memberCount} members</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="p-3 text-center border-t border-border">
                                <button
                                    onClick={() => setShowCreateCommunity(true)}
                                    className="text-sm font-medium text-blue-600 hover:underline"
                                >
                                    Create new community
                                </button>
                            </div>
                        </div>

                        {/* Rules / Footer */}
                        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-border p-4">
                            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                <Shield size={16} /> Code of Conduct
                            </div>
                            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">1.</span>
                                    <span>Be respectful to others</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">2.</span>
                                    <span>Cite your sources</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">3.</span>
                                    <span>No spam or self-promotion</span>
                                </li>
                            </ul>
                            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground text-center">
                                © 2025 Venalium. All rights reserved.
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals remain the same, just keeping them in the render */}
            {/* Create Post Modal */}
            <AnimatePresence>
                {showCreatePost && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreatePost(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-xl font-bold">Create a post</h2>
                                <button onClick={() => setShowCreatePost(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Community Select */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Select Community</label>
                                    <select
                                        value={postCommunity}
                                        onChange={e => setPostCommunity(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                                    >
                                        <option value="">Choose a community</option>
                                        {communities.map(c => (
                                            <option key={c.id} value={c.id}>r/{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Post Type Tabs */}
                                <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                                    {[
                                        { id: 'text', icon: FileText, label: 'Text' },
                                        { id: 'link', icon: LinkIcon, label: 'Link' },
                                        { id: 'image', icon: ImageIcon, label: 'Image' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setPostType(tab.id as PostType)}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all font-medium text-sm ${postType === tab.id
                                                ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            <tab.icon size={16} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Title */}
                                <input
                                    type="text"
                                    value={postTitle}
                                    onChange={e => setPostTitle(e.target.value)}
                                    placeholder="Title"
                                    className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 text-lg font-medium outline-none"
                                    maxLength={300}
                                />

                                {/* Content based on type */}
                                {postType === 'text' && (
                                    <textarea
                                        value={postContent}
                                        onChange={e => setPostContent(e.target.value)}
                                        placeholder="Body text (optional)"
                                        className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 min-h-[150px] resize-none outline-none"
                                    />
                                )}

                                {postType === 'link' && (
                                    <div className="relative">
                                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                        <input
                                            type="url"
                                            value={postLink}
                                            onChange={e => setPostLink(e.target.value)}
                                            placeholder="https://example.com"
                                            className="w-full pl-12 pr-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-border flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-900/50">
                                <button
                                    onClick={() => setShowCreatePost(false)}
                                    className="px-5 py-2 text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!postTitle.trim() || !postCommunity || isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                                    Post
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreateCommunity(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-xl font-bold">Create a community</h2>
                                <button onClick={() => setShowCreateCommunity(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Name</label>
                                    <div className="flex items-center border border-border rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                        <span className="text-muted-foreground font-medium">r/</span>
                                        <input
                                            type="text"
                                            value={communityName}
                                            onChange={e => setCommunityName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                                            placeholder="communityname"
                                            className="flex-1 px-2 py-2.5 bg-transparent focus:outline-none"
                                            maxLength={21}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                        <Shield size={12} />
                                        Community names cannot be changed.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={communityDisplayName}
                                        onChange={e => setCommunityDisplayName(e.target.value)}
                                        placeholder="My Amazing Community"
                                        className="w-full px-4 py-2.5 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                                        maxLength={50}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Description</label>
                                    <textarea
                                        value={communityDescription}
                                        onChange={e => setCommunityDescription(e.target.value)}
                                        placeholder="What is this community all about?"
                                        className="w-full px-4 py-2.5 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none outline-none"
                                        maxLength={500}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-border flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-900/50">
                                <button
                                    onClick={() => setShowCreateCommunity(false)}
                                    className="px-5 py-2 text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCommunity}
                                    disabled={!communityName.trim() || !communityDisplayName.trim() || isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                                    Create Community
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
