'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import { useRouter }
    from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DotPatternBackground } from '@/components/ui/dot-pattern-background';
import { ArrowRight, Sparkles, Zap, Users, Search, Loader2 } from 'lucide-react';
import { createProject } from '@/lib/firestore';
import LandingPage from '@/components/LandingPage';
import VenaliumLoading from '@/components/VenaliumLoading';

export default function Home() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [creatingStatus, setCreatingStatus] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        if (!user) {
            router.push('/login');
            return;
        }

        setIsCreating(true);
        setCreatingStatus('Analyzing your research topic...');
        try {
            // Use gemini-2.5-flash for combined naming + config extraction
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    task: 'summary',
                    prompt: `Analyze this research request and extract configuration.
User Input: "${searchTerm}"

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
                projectName: searchTerm.substring(0, 50),
                keywords: searchTerm,
                languages: ['en'],
                startYear: 2020,
                endYear: 2025,
                scopusCount: 15,
                geminiCount: 15
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

            setCreatingStatus('Creating your workspace...');

            // Create project with the AI-generated name
            const projectId = await createProject(
                user.uid,
                config.projectName,
                `Research project about: ${searchTerm.trim()}`,
                'Compass',
                'blue',
                ['research', 'smart-create'],
                false,
                user.displayName || 'Anonymous',
                user.email || '',
                false
            );

            setCreatingStatus('Preparing research environment...');
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
                originalMessage: searchTerm
            };

            // Redirect with full config
            router.push(`/project/${projectId}?initialSearchConfig=${encodeURIComponent(JSON.stringify(searchConfig))}`);
        } catch (error) {
            console.error("Failed to create project from search", error);
            setIsCreating(false);
            setCreatingStatus('');
            alert("Failed to create project. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) {
        return <LandingPage />;
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
            <Sidebar />

            {/* Full-screen Loading Overlay */}
            <AnimatePresence>
                {isCreating && (
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
                            {creatingStatus}
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

            <main className="flex-1 relative overflow-hidden">
                <DotPatternBackground className="h-full" showMarquee={false} animateDots={false}>
                    <div className="h-full overflow-y-auto w-full">
                        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-24">
                            <motion.div
                                initial={{ opacity: 0.0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: 0.3,
                                    duration: 0.8,
                                    ease: "easeInOut",
                                }}
                                className="relative flex flex-col gap-4 items-center justify-center max-w-4xl mx-auto text-center w-full"
                            >
                                {/* Brand Identity */}
                                <div className="space-y-4 mb-10">
                                    <h1 className="text-7xl md:text-9xl font-serif tracking-tighter font-medium text-neutral-900 leading-none dark:text-white drop-shadow-sm">
                                        Venalium<span className="text-blue-600">.</span>
                                    </h1>
                                    <div className="flex items-center justify-center gap-4 text-xs font-medium tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400">
                                        <span>Research</span>
                                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                                        <span>Intelligence</span>
                                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                                        <span>Future</span>
                                    </div>
                                </div>

                                <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 max-w-2xl mb-10 font-light leading-relaxed">
                                    Welcome back{user?.displayName ? `, ${user.displayName}` : ''}. <br />
                                    What do you want to research?
                                </p>

                                {/* Search Box */}
                                <form onSubmit={handleSearch} className="w-full max-w-3xl mb-12 relative group z-10">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all opacity-0 group-hover:opacity-100 duration-500"></div>
                                    <div className="relative flex items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-xl hover:shadow-2xl hover:border-blue-500/50 transition-all duration-300 overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                        <div className="pl-6 text-neutral-400">
                                            <Search size={24} />
                                        </div>
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Enter a research topic to create a new project..."
                                            disabled={isCreating}
                                            className="w-full bg-transparent border-none py-4 px-4 text-lg outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-white"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            disabled={!searchTerm.trim() || isCreating}
                                            className="mr-2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isCreating ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
                                        </button>
                                    </div>
                                </form>

                                <div className="flex flex-wrap items-center justify-center gap-6">
                                    <button
                                        onClick={() => router.push('/dashboard')}
                                        className="rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-8 py-4 text-base font-medium shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
                                    >
                                        Go to Dashboard
                                    </button>
                                    <button
                                        onClick={() => router.push('/explore')}
                                        className="rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white px-8 py-4 text-base font-medium shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                                    >
                                        Explore Projects
                                    </button>
                                </div>

                                {/* Feature Briefs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10 text-left w-full max-w-5xl">
                                    {[
                                        {
                                            title: "Analysis",
                                            desc: "Deep AI-powered insights",
                                            icon: Sparkles
                                        },
                                        {
                                            title: "Knowledge",
                                            desc: "Interactive visual graphs",
                                            icon: Zap
                                        },
                                        {
                                            title: "Collaboration",
                                            desc: "Real-time team sync",
                                            icon: Users
                                        }
                                    ].map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.5 + (i * 0.1) }}
                                            className="p-6 rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
                                        >
                                            <item.icon className="w-6 h-6 mb-3 text-neutral-400" />
                                            <h3 className="font-serif text-lg font-medium mb-1">{item.title}</h3>
                                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </DotPatternBackground>
            </main>
        </div>
    );
}
