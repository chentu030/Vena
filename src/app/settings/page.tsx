'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Check, Camera, Loader2, Globe, Laptop, Moon, Sun,
    Save, ChevronRight, Mail, Briefcase, Building, Link as LinkIcon, AlertCircle
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import { useTheme } from 'next-themes';
import { getUserProfile, updateUserProfile, UserProfile } from '@/lib/firestore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type SettingsTab = 'profile' | 'appearance' | 'account' | 'notifications';

export default function SettingsPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Profile State
    const [profile, setProfile] = useState<UserProfile>({
        uid: '',
        displayName: '',
        email: '',
        bio: '',
        jobTitle: '',
        organization: '',
        website: '',
        photoURL: '',
        language: 'en',
        themePreference: 'system',
        backgroundIntensity: 50
    });

    // Avatar Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    useEffect(() => {
        if (!user && !loading) {
            router.push('/login');
            return;
        }

        if (user) {
            // Load profile from Firestore
            getUserProfile(user.uid).then(data => {
                if (data) {
                    setProfile({ ...data }); // Ensure we have a fresh object
                } else {
                    // Initialize with Auth data if no profile exists
                    setProfile(prev => ({
                        ...prev,
                        uid: user.uid,
                        displayName: user.displayName || '',
                        email: user.email || '',
                        photoURL: user.photoURL || ''
                    }));
                }
                setIsLoading(false);
            });
        }
    }, [user, loading, router]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        setMessage(null);
        try {
            await updateUserProfile(user.uid, profile);
            setMessage({ type: 'success', text: 'Settings saved successfully' });

            // Auto hide message
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            setIsUploadingAvatar(true);

            // Preview immediately
            const objectUrl = URL.createObjectURL(file);
            setAvatarPreview(objectUrl);

            try {
                // Upload to Storage
                const storagePath = `users/${user.uid}/avatar_${Date.now()}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(storageRef);

                // Update Profile State
                setProfile(prev => ({ ...prev, photoURL: downloadUrl }));

                // Automatically save the new avatar URL to profile
                await updateUserProfile(user.uid, { photoURL: downloadUrl });
                setMessage({ type: 'success', text: 'Avatar updated' });
                setTimeout(() => setMessage(null), 3000);

            } catch (error) {
                console.error("Avatar upload failed:", error);
                setMessage({ type: 'error', text: 'Failed to upload image' });
                setAvatarPreview(null); // Revert preview on error
            } finally {
                setIsUploadingAvatar(false);
            }
        }
    };

    if (loading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
        );
    }

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'appearance', label: 'Appearance', icon: Laptop },
        // { id: 'notifications', label: 'Notifications', icon: Bell }, // Future
        // { id: 'account', label: 'Account', icon: Shield } // Future
    ];

    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
            <Sidebar />

            <main className="flex-1 max-w-5xl mx-auto p-6 lg:p-10">
                <header className="mb-10">
                    <h1 className="text-3xl font-serif font-bold mb-2">Settings</h1>
                    <p className="text-neutral-500 dark:text-neutral-400">Manage your profile and preferences.</p>
                </header>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Settings Sidebar */}
                    <nav className="lg:w-64 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as SettingsTab)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === tab.id
                                        ? 'bg-white dark:bg-neutral-800 shadow-sm text-blue-600 dark:text-blue-400'
                                        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                                {activeTab === tab.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
                            </button>
                        ))}
                    </nav>

                    {/* Main Content Area */}
                    <div className="flex-1 space-y-6">
                        <AnimatePresence mode="wait">
                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <motion.div
                                    key="profile"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Avatar Section */}
                                    <section className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                        <h2 className="text-lg font-bold mb-6">Profile Picture</h2>
                                        <div className="flex items-center gap-6">
                                            <div className="relative group">
                                                <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-700 shadow-lg">
                                                    {(avatarPreview || profile.photoURL) ? (
                                                        <img
                                                            src={avatarPreview || profile.photoURL}
                                                            alt="Avatar"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-blue-500 to-emerald-500 text-white">
                                                            {profile.displayName?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                    )}

                                                    {/* Upload Overlay */}
                                                    <div
                                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <Camera className="text-white" size={24} />
                                                    </div>
                                                </div>
                                                {isUploadingAvatar && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 rounded-full">
                                                        <Loader2 className="animate-spin text-blue-500" size={20} />
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex gap-3 mb-2">
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                                    >
                                                        Change Photo
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAvatarPreview(null);
                                                            setProfile(p => ({ ...p, photoURL: '' }));
                                                        }}
                                                        className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <p className="text-xs text-neutral-400">Supported formats: JPG, PNG, GIF. Max size: 5MB.</p>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleAvatarChange}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Personal Info */}
                                    <section className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                                        <h2 className="text-lg font-bold">Personal Information</h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-neutral-500">Display Name</label>
                                                <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 ring-blue-500/20 transition-all">
                                                    <User size={18} className="text-neutral-400" />
                                                    <input
                                                        type="text"
                                                        value={profile.displayName}
                                                        onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                                                        className="bg-transparent border-none outline-none flex-1 font-medium"
                                                        placeholder="Your Name"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-neutral-500">Email Address</label>
                                                <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-transparent opacity-70 cursor-not-allowed">
                                                    <Mail size={18} className="text-neutral-400" />
                                                    <input
                                                        type="email"
                                                        value={profile.email}
                                                        disabled
                                                        className="bg-transparent border-none outline-none flex-1 font-medium text-neutral-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-neutral-500">Job Title</label>
                                                <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 ring-blue-500/20 transition-all">
                                                    <Briefcase size={18} className="text-neutral-400" />
                                                    <input
                                                        type="text"
                                                        value={profile.jobTitle || ''}
                                                        onChange={e => setProfile({ ...profile, jobTitle: e.target.value })}
                                                        className="bg-transparent border-none outline-none flex-1"
                                                        placeholder="e.g. Senior Researcher"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-neutral-500">Organization</label>
                                                <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 ring-blue-500/20 transition-all">
                                                    <Building size={18} className="text-neutral-400" />
                                                    <input
                                                        type="text"
                                                        value={profile.organization || ''}
                                                        onChange={e => setProfile({ ...profile, organization: e.target.value })}
                                                        className="bg-transparent border-none outline-none flex-1"
                                                        placeholder="e.g. University of Science"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-sm font-medium text-neutral-500">Website</label>
                                                <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 ring-blue-500/20 transition-all">
                                                    <LinkIcon size={18} className="text-neutral-400" />
                                                    <input
                                                        type="url"
                                                        value={profile.website || ''}
                                                        onChange={e => setProfile({ ...profile, website: e.target.value })}
                                                        className="bg-transparent border-none outline-none flex-1"
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-sm font-medium text-neutral-500">Bio</label>
                                                <textarea
                                                    value={profile.bio || ''}
                                                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                                                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 focus:ring-2 ring-blue-500/20 outline-none min-h-[120px] resize-none leading-relaxed"
                                                    placeholder="Tell us a bit about yourself..."
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </motion.div>
                            )}

                            {/* APPEARANCE TAB */}
                            {activeTab === 'appearance' && (
                                <motion.div
                                    key="appearance"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <section className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                                        <h2 className="text-lg font-bold">Theme Preferences</h2>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[
                                                { id: 'light', label: 'Light', icon: Sun },
                                                { id: 'dark', label: 'Dark', icon: Moon },
                                                { id: 'system', label: 'System', icon: Laptop },
                                            ].map((mode) => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => {
                                                        setTheme(mode.id);
                                                        setProfile({ ...profile, themePreference: mode.id as any });
                                                    }}
                                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${theme === mode.id
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                            : 'border-transparent bg-neutral-50 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                                        }`}
                                                >
                                                    <mode.icon size={24} />
                                                    <span className="font-medium">{mode.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
                                            <h3 className="text-sm font-bold mb-4">Language</h3>
                                            <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                                <Globe size={20} className="text-neutral-400" />
                                                <select
                                                    value={profile.language || 'en'}
                                                    onChange={e => setProfile({ ...profile, language: e.target.value as any })}
                                                    className="bg-transparent outline-none flex-1 cursor-pointer"
                                                >
                                                    <option value="en">English (US)</option>
                                                    <option value="zh">Traditional Chinese</option>
                                                    <option value="es">Español</option>
                                                    <option value="ja">日本語</option>
                                                </select>
                                                <ChevronRight size={16} className="text-neutral-400" />
                                            </div>
                                        </div>
                                    </section>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Save Button (Global) */}
                        <div className="flex items-center justify-end gap-4 pt-4 border-t border-transparent">
                            <AnimatePresence>
                                {message && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'
                                            }`}
                                    >
                                        {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                        {message.text}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {isSaving ? 'Saving Checkpoints...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
