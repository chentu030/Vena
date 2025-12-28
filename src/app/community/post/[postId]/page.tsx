'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark,
    ArrowLeft, Loader2, Send, MoreHorizontal, Trash2, Link as LinkIcon
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import {
    CommunityPost, PostComment, getPost, subscribeToComments,
    votePost, voteComment, createComment, deletePost
} from '@/lib/firestore';

export default function PostDetailPage() {
    const router = useRouter();
    const params = useParams();
    const postId = params.postId as string;
    const { user, loading } = useAuth();

    const [post, setPost] = useState<CommunityPost | null>(null);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!postId) return;

        // Load post
        getPost(postId).then(p => {
            setPost(p);
            setIsLoading(false);
        });

        // Subscribe to comments
        const unsubComments = subscribeToComments(postId, setComments);

        return () => {
            unsubComments();
        };
    }, [postId]);

    const handleVotePost = async (voteType: 'up' | 'down') => {
        if (!user || !post) return;
        await votePost(post.id, user.uid, voteType);
        // Refetch post
        const updated = await getPost(postId);
        setPost(updated);
    };

    const handleVoteComment = async (commentId: string, voteType: 'up' | 'down') => {
        if (!user) return;
        await voteComment(commentId, user.uid, voteType);
    };

    const handleAddComment = async () => {
        if (!user || !post || !newComment.trim()) return;
        setIsSubmitting(true);

        try {
            await createComment({
                postId: post.id,
                parentId: null,
                content: newComment,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                depth: 0
            });
            setNewComment('');
            // Refetch post for updated comment count
            const updated = await getPost(postId);
            setPost(updated);
        } catch (error) {
            console.error('Failed to add comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReply = async (parentId: string, depth: number) => {
        if (!user || !post || !replyText.trim()) return;
        setIsSubmitting(true);

        try {
            await createComment({
                postId: post.id,
                parentId,
                content: replyText,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                depth: depth + 1
            });
            setReplyText('');
            setReplyingTo(null);
            // Refetch post
            const updated = await getPost(postId);
            setPost(updated);
        } catch (error) {
            console.error('Failed to reply:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePost = async () => {
        if (!user || !post || post.authorId !== user.uid) return;
        if (!confirm('Are you sure you want to delete this post?')) return;

        await deletePost(post.id);
        router.push('/community');
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

    // Build comment tree
    const buildCommentTree = (comments: PostComment[]) => {
        const map = new Map<string, PostComment & { replies: PostComment[] }>();
        const roots: (PostComment & { replies: PostComment[] })[] = [];

        comments.forEach(c => map.set(c.id, { ...c, replies: [] }));

        comments.forEach(c => {
            if (c.parentId && map.has(c.parentId)) {
                map.get(c.parentId)!.replies.push(map.get(c.id)!);
            } else if (!c.parentId) {
                roots.push(map.get(c.id)!);
            }
        });

        return roots;
    };

    const renderComment = (comment: PostComment & { replies: PostComment[] }, depth = 0) => {
        const score = comment.upvotes.length - comment.downvotes.length;
        const hasUpvoted = user && comment.upvotes.includes(user.uid);
        const hasDownvoted = user && comment.downvotes.includes(user.uid);

        return (
            <div key={comment.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-neutral-200 dark:border-neutral-700 pl-4' : ''}`}>
                <div className="py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{comment.authorName}</span>
                        <span>•</span>
                        <span>{formatTime(comment.createdAt)}</span>
                    </div>

                    <p className="text-sm mb-2">{comment.content}</p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <button
                            onClick={() => handleVoteComment(comment.id, 'up')}
                            className={`p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 ${hasUpvoted ? 'text-orange-500' : ''}`}
                        >
                            <ArrowBigUp size={16} fill={hasUpvoted ? 'currentColor' : 'none'} />
                        </button>
                        <span className={`font-medium ${hasUpvoted ? 'text-orange-500' : hasDownvoted ? 'text-blue-500' : ''}`}>
                            {score}
                        </span>
                        <button
                            onClick={() => handleVoteComment(comment.id, 'down')}
                            className={`p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 ${hasDownvoted ? 'text-blue-500' : ''}`}
                        >
                            <ArrowBigDown size={16} fill={hasDownvoted ? 'currentColor' : 'none'} />
                        </button>
                        <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="font-medium hover:underline"
                        >
                            Reply
                        </button>
                    </div>

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                        <div className="mt-3 flex gap-2">
                            <input
                                type="text"
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={() => handleReply(comment.id, comment.depth)}
                                disabled={!replyText.trim() || isSubmitting}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Reply'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Nested Replies */}
                {comment.replies.length > 0 && (
                    <div>
                        {comment.replies.map(reply => renderComment(reply as any, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (loading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Post not found</h2>
                        <button
                            onClick={() => router.push('/community')}
                            className="text-blue-500 hover:underline"
                        >
                            Back to Community
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const score = post.upvotes.length - post.downvotes.length;
    const hasUpvoted = user && post.upvotes.includes(user.uid);
    const hasDownvoted = user && post.downvotes.includes(user.uid);
    const commentTree = buildCommentTree(comments);

    return (
        <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
            <Sidebar />

            <main className="flex-1 p-4 lg:p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Back Button */}
                    <button
                        onClick={() => router.push('/community')}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Community
                    </button>

                    {/* Post */}
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border overflow-hidden mb-4">
                        <div className="flex">
                            {/* Vote Column */}
                            <div className="w-12 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col items-center py-4 gap-1">
                                <button
                                    onClick={() => handleVotePost('up')}
                                    className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasUpvoted ? 'text-orange-500' : 'text-muted-foreground'}`}
                                >
                                    <ArrowBigUp size={28} fill={hasUpvoted ? 'currentColor' : 'none'} />
                                </button>
                                <span className={`font-bold ${hasUpvoted ? 'text-orange-500' : hasDownvoted ? 'text-blue-500' : ''}`}>
                                    {score}
                                </span>
                                <button
                                    onClick={() => handleVotePost('down')}
                                    className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${hasDownvoted ? 'text-blue-500' : 'text-muted-foreground'}`}
                                >
                                    <ArrowBigDown size={28} fill={hasDownvoted ? 'currentColor' : 'none'} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                    <span className="font-medium text-foreground hover:underline cursor-pointer">
                                        r/{post.communityName}
                                    </span>
                                    <span>•</span>
                                    <span>Posted by u/{post.authorName}</span>
                                    <span>•</span>
                                    <span>{formatTime(post.createdAt)}</span>

                                    {user && post.authorId === user.uid && (
                                        <button
                                            onClick={handleDeletePost}
                                            className="ml-auto p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>

                                <h1 className="text-2xl font-bold mb-4">{post.title}</h1>

                                {post.content && (
                                    <p className="text-foreground mb-4 whitespace-pre-wrap">
                                        {post.content}
                                    </p>
                                )}

                                {post.linkUrl && (
                                    <a
                                        href={post.linkUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline flex items-center gap-2 mb-4"
                                    >
                                        <LinkIcon size={16} />
                                        {post.linkUrl}
                                    </a>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-4 text-muted-foreground pt-3 border-t border-border">
                                    <div className="flex items-center gap-2 font-medium">
                                        <MessageSquare size={18} />
                                        {post.commentCount} Comments
                                    </div>
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
                    </div>

                    {/* Add Comment */}
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border p-4 mb-4">
                        <p className="text-sm text-muted-foreground mb-2">
                            Comment as <span className="font-medium text-foreground">{user?.displayName || 'Anonymous'}</span>
                        </p>
                        <textarea
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="What are your thoughts?"
                            className="w-full px-4 py-3 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none mb-3"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleAddComment}
                                disabled={!newComment.trim() || isSubmitting}
                                className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                                Comment
                            </button>
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border">
                        {comments.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No comments yet. Be the first to share your thoughts!
                            </div>
                        ) : (
                            <div className="p-4 divide-y divide-border">
                                {commentTree.map(comment => renderComment(comment as any))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
