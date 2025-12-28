'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark,
    Plus, TrendingUp, Clock, Award, ChevronDown, Users, Search,
    X, Link as LinkIcon, FileText, Image as ImageIcon, Loader2
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
                communityName: community?.name || 'general',
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

    return (
        <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
            <Sidebar />

            <main className="flex-1 p-4 lg:p-6">
                <div className="max-w-6xl mx-auto flex gap-6">
                    {/* Main Feed */}
                    <div className="flex-1 space-y-4">
                        {/* Create Post Card */}
                        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {user?.displayName?.charAt(0) || 'U'}
                            </div>
                            <button
                                onClick={() => setShowCreatePost(true)}
                                className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-full px-4 py-2 text-left text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                Create Post
                            </button>
                            <button
                                onClick={() => setShowCreatePost(true)}
                                className="p-2 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                            >
                                <ImageIcon size={20} />
                            </button>
                            <button
                                onClick={() => setShowCreatePost(true)}
                                className="p-2 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                            >
                                <LinkIcon size={20} />
                            </button>
                        </div>

                        {/* Sort Tabs */}
                        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border p-2 flex items-center gap-1">
                            {[
                                { id: 'hot', icon: TrendingUp, label: 'Hot' },
                                { id: 'new', icon: Clock, label: 'New' },
                                { id: 'top', icon: Award, label: 'Top' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSortBy(tab.id as SortType)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${sortBy === tab.id
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                        : 'text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    <tab.icon size={18} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Posts */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-muted-foreground" size={32} />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border p-12 text-center">
                                <MessageSquare className="mx-auto mb-4 text-muted-foreground" size={48} />
                                <h3 className="text-lg font-medium mb-2">No posts yet</h3>
                                <p className="text-muted-foreground mb-4">Be the first to share something!</p>
                                <button
                                    onClick={() => setShowCreatePost(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                >
                                    Create Post
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {posts.map(post => {
                                    const score = post.upvotes.length - post.downvotes.length;
                                    const hasUpvoted = user && post.upvotes.includes(user.uid);
                                    const hasDownvoted = user && post.downvotes.includes(user.uid);

                                    return (
                                        <motion.div
                                            key={post.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white dark:bg-neutral-900 rounded-xl border border-border hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors overflow-hidden"
                                        >
                                            <div className="flex">
                                                {/* Vote Column */}
                                                <div className="w-12 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col items-center py-3 gap-1">
                                                    <button
                                                        onClick={() => handleVote(post.id, 'up')}
                                                        className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasUpvoted ? 'text-orange-500' : 'text-muted-foreground'}`}
                                                    >
                                                        <ArrowBigUp size={24} fill={hasUpvoted ? 'currentColor' : 'none'} />
                                                    </button>
                                                    <span className={`font-bold text-sm ${hasUpvoted ? 'text-orange-500' : hasDownvoted ? 'text-blue-500' : ''}`}>
                                                        {score}
                                                    </span>
                                                    <button
                                                        onClick={() => handleVote(post.id, 'down')}
                                                        className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasDownvoted ? 'text-blue-500' : 'text-muted-foreground'}`}
                                                    >
                                                        <ArrowBigDown size={24} fill={hasDownvoted ? 'currentColor' : 'none'} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 p-3">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                        <span className="font-medium text-foreground hover:underline cursor-pointer">
                                                            r/{post.communityName}
                                                        </span>
                                                        <span>•</span>
                                                        <span>Posted by u/{post.authorName}</span>
                                                        <span>•</span>
                                                        <span>{formatTime(post.createdAt)}</span>
                                                    </div>

                                                    <h2
                                                        className="text-lg font-medium mb-2 hover:text-blue-600 cursor-pointer"
                                                        onClick={() => router.push(`/community/post/${post.id}`)}
                                                    >
                                                        {post.title}
                                                    </h2>

                                                    {post.content && (
                                                        <p className="text-muted-foreground mb-3 line-clamp-3">
                                                            {post.content}
                                                        </p>
                                                    )}

                                                    {post.linkUrl && (
                                                        <a
                                                            href={post.linkUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-500 hover:underline text-sm flex items-center gap-1 mb-3"
                                                        >
                                                            <LinkIcon size={14} />
                                                            {new URL(post.linkUrl).hostname}
                                                        </a>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-4 text-muted-foreground">
                                                        <button
                                                            onClick={() => router.push(`/community/post/${post.id}`)}
                                                            className="flex items-center gap-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-full transition-colors"
                                                        >
                                                            <MessageSquare size={18} />
                                                            {post.commentCount} Comments
                                                        </button>
                                                        <button className="flex items-center gap-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-full transition-colors">
                                                            <Share2 size={18} />
                                                            Share
                                                        </button>
                                                        <button className="flex items-center gap-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-full transition-colors">
                                                            <Bookmark size={18} />
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
                    <div className="hidden lg:block w-80 space-y-4">
                        {/* User Card */}
                        {user && (
                            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                        {user.displayName?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <div className="font-medium">{user.displayName || 'User'}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {userKarma.postKarma + userKarma.commentKarma} karma
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreatePost(true)}
                                    className="w-full py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
                                >
                                    New Post
                                </button>
                            </div>
                        )}

                        {/* Communities */}
                        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border overflow-hidden">
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h3 className="font-medium">Communities</h3>
                                <button
                                    onClick={() => setShowCreateCommunity(true)}
                                    className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                                >
                                    + Create
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <button
                                    onClick={() => setSelectedCommunity(null)}
                                    className={`w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3 ${!selectedCommunity ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm">
                                        🌐
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">All</div>
                                        <div className="text-xs text-muted-foreground">Browse all posts</div>
                                    </div>
                                </button>
                                {communities.map(comm => (
                                    <button
                                        key={comm.id}
                                        onClick={() => setSelectedCommunity(comm.id)}
                                        className={`w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3 ${selectedCommunity === comm.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                            {comm.displayName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm">r/{comm.name}</div>
                                            <div className="text-xs text-muted-foreground">{comm.memberCount} members</div>
                                        </div>
                                    </button>
                                ))}
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreatePost(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-xl font-bold">Create a post</h2>
                                <button onClick={() => setShowCreatePost(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Community Select */}
                                <select
                                    value={postCommunity}
                                    onChange={e => setPostCommunity(e.target.value)}
                                    className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Choose a community</option>
                                    {communities.map(c => (
                                        <option key={c.id} value={c.id}>r/{c.name}</option>
                                    ))}
                                </select>

                                {/* Post Type Tabs */}
                                <div className="flex gap-2 border-b border-border">
                                    {[
                                        { id: 'text', icon: FileText, label: 'Text' },
                                        { id: 'link', icon: LinkIcon, label: 'Link' },
                                        { id: 'image', icon: ImageIcon, label: 'Image' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setPostType(tab.id as PostType)}
                                            className={`flex items-center gap-2 px-4 py-2 border-b-2 -mb-px transition-colors ${postType === tab.id
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            <tab.icon size={18} />
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
                                    className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 text-lg"
                                    maxLength={300}
                                />

                                {/* Content based on type */}
                                {postType === 'text' && (
                                    <textarea
                                        value={postContent}
                                        onChange={e => setPostContent(e.target.value)}
                                        placeholder="Text (optional)"
                                        className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 min-h-[150px] resize-none"
                                    />
                                )}

                                {postType === 'link' && (
                                    <input
                                        type="url"
                                        value={postLink}
                                        onChange={e => setPostLink(e.target.value)}
                                        placeholder="URL"
                                        className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>

                            <div className="p-4 border-t border-border flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreatePost(false)}
                                    className="px-4 py-2 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!postTitle.trim() || !postCommunity || isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                            className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-xl font-bold">Create a community</h2>
                                <button onClick={() => setShowCreateCommunity(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Name</label>
                                    <div className="flex items-center border border-border rounded-lg px-3">
                                        <span className="text-muted-foreground">r/</span>
                                        <input
                                            type="text"
                                            value={communityName}
                                            onChange={e => setCommunityName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                                            placeholder="communityname"
                                            className="flex-1 px-2 py-2 bg-transparent focus:outline-none"
                                            maxLength={21}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Community names cannot be changed.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={communityDisplayName}
                                        onChange={e => setCommunityDisplayName(e.target.value)}
                                        placeholder="My Community"
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
                                        maxLength={50}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Description</label>
                                    <textarea
                                        value={communityDescription}
                                        onChange={e => setCommunityDescription(e.target.value)}
                                        placeholder="What is this community about?"
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                                        maxLength={500}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-border flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateCommunity(false)}
                                    className="px-4 py-2 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCommunity}
                                    disabled={!communityName.trim() || !communityDisplayName.trim() || isSubmitting}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
