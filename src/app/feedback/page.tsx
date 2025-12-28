'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, Upload, Send, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLanguage } from '@/context/LanguageContext';

export default function FeedbackPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const [comment, setComment] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;

        setIsSubmitting(true);
        try {
            const imageUrls: string[] = [];

            // 1. Upload Images (if exist) via GAS Proxy
            if (files.length > 0) {
                const uploadPromises = files.map(async (file) => {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve, reject) => {
                        reader.onload = () => {
                            const base64Index = (reader.result as string).indexOf('base64,');
                            if (base64Index !== -1) {
                                resolve((reader.result as string).substring(base64Index + 7));
                            } else {
                                reject(new Error('Invalid base64 conversion'));
                            }
                        };
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(file);
                    const base64Content = await base64Promise;

                    const uploadRes = await fetch('/api/upload-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: `feedback_${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`,
                            mimeType: file.type,
                            fileContent: base64Content
                        })
                    });

                    const uploadData = await uploadRes.json();
                    if (uploadData.url) {
                        return uploadData.url;
                    } else {
                        console.warn('Image upload failed', file.name, uploadData);
                        return null;
                    }
                });

                const results = await Promise.all(uploadPromises);
                results.forEach(url => {
                    if (url) imageUrls.push(url);
                });
            }

            // 2. Save Feedback to Firestore
            await addDoc(collection(db, 'feedback'), {
                userId: user?.uid || 'anonymous',
                userEmail: user?.email || 'anonymous',
                comment: comment,
                imageUrls: imageUrls, // Array of URLs
                createdAt: serverTimestamp(),
                status: 'new',
                userAgent: navigator.userAgent
            });

            setSuccess(true);
            setComment('');
            setFiles([]);
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);

        } catch (error) {
            console.error('Feedback submission error:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-border p-8 animate-in slide-in-from-bottom-5 duration-500">

                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
                >
                    <ArrowLeft size={16} className="mr-1" /> {t('feedback.back')}
                </button>

                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-serif font-bold mb-2">{t('feedback.title')}</h1>
                    <p className="text-muted-foreground text-sm">
                        {t('feedback.subtitle')}
                    </p>
                </div>

                {success ? (
                    <div className="text-center py-12 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <Send size={32} />
                        </div>
                        <h3 className="text-xl font-medium text-green-600 mb-2">{t('feedback.success.title')}</h3>
                        <p className="text-neutral-500 text-sm">{t('feedback.success.message')}</p>
                        <p className="text-neutral-400 text-xs mt-4">{t('feedback.success.redirecting')}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                {t('feedback.form.messageLabel')}
                            </label>
                            <textarea
                                required
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t('feedback.form.messagePlaceholder')}
                                className="w-full h-32 px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all placeholder:text-neutral-400 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                {t('feedback.form.screenshotsLabel')}
                            </label>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="mb-3 space-y-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <ImageIcon size={16} className="text-blue-500 flex-shrink-0" />
                                                <span className="truncate max-w-[200px]">{f.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(i)}
                                                className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-border bg-neutral-50 dark:bg-neutral-800 text-neutral-500 group-hover:bg-neutral-100 dark:group-hover:bg-neutral-700 rounded-xl transition-all">
                                    <Upload size={20} />
                                    <span className="text-sm">{t('feedback.form.clickToAdd')}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !comment.trim()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" /> {t('feedback.form.submitting')}
                                </>
                            ) : (
                                <>
                                    {t('feedback.form.submit')} <Send size={18} />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
