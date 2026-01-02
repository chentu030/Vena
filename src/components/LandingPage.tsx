'use client';

import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { DotPatternBackground } from '@/components/ui/dot-pattern-background';
import { ArrowRight, Sparkles, Zap, Users, Shield, Globe, Cpu, ChevronRight, BarChart3, Share2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import VenaliumLoading from '@/components/VenaliumLoading';

const FadeIn = ({ children, delay = 0, className }: { children: React.ReactNode, delay?: number, className?: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

const BentoCard = ({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={cn(
                "relative overflow-hidden rounded-[2.5rem] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 hover:bg-white/60 dark:hover:bg-neutral-900/60 transition-colors duration-500 group",
                className
            )}
        >
            {children}
        </motion.div>
    );
};

const InteractiveText = ({ text, className, delay = 0 }: { text: string, className?: string, delay?: number }) => {
    return (
        <motion.span
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
            className={cn("inline-block cursor-default", className)}
        >
            {text.split("").map((char, i) => (
                <motion.span
                    key={i}
                    className="inline-block"
                    whileHover={{
                        scale: 1.1,
                        y: -10,
                        rotate: Math.random() * 10 - 5,
                        transition: { duration: 0.2 }
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
        </motion.span>
    );
};

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-blue-500/30">
            <main className="flex-1 relative">
                <DotPatternBackground
                    className="h-full min-h-screen !block"
                    bodyClassName="w-full h-full"
                >
                    <div className="h-full w-full overflow-y-auto overflow-x-hidden perspective-1000">

                        {/* Navigation */}
                        <header className="sticky top-0 w-full z-50 px-6 py-6 flex items-center justify-between backdrop-blur-md bg-white/5 dark:bg-black/5 border-b border-white/5 transition-all duration-300">
                            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push('/')}>
                                <img src="/venalium.png" alt="Venalium" className="w-10 h-10 rounded-xl group-hover:scale-105 transition-transform duration-300 dark:invert" />
                                <span className="font-bold text-xl font-serif text-neutral-900 dark:text-white tracking-tight">Venalium.</span>
                            </div>
                            <button
                                onClick={() => router.push('/login')}
                                className="px-8 py-3 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-black/5"
                            >
                                Sign In
                            </button>
                        </header>

                        {/* Hero Section */}
                        <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-32">
                            <div className="max-w-[90rem] mx-auto w-full text-center z-10">
                                <motion.div
                                    initial={{ opacity: 0, y: 100 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                    className="relative inline-block mb-6"
                                >
                                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-[3rem] blur-3xl opacity-50 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
                                    <span className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                        <Sparkles className="w-4 h-4 text-blue-500 fill-blue-500" />
                                        Next Generation Research Platform
                                    </span>
                                </motion.div>

                                <h1 className="text-[12vw] md:text-[9vw] font-serif font-medium leading-[0.85] tracking-tighter text-neutral-900 dark:text-white mix-blend-overlay dark:mix-blend-normal mb-12 select-none flex flex-col items-center">
                                    <InteractiveText text="Research" delay={0.1} />
                                    <InteractiveText text="Reimagined." className="text-blue-600 dark:text-blue-500" delay={0.2} />
                                </h1>

                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 1, delay: 0.4 }}
                                    className="text-xl md:text-3xl text-neutral-600 dark:text-neutral-300 max-w-3xl mx-auto font-light leading-relaxed mb-16"
                                >
                                    The intelligent workspace where global knowledge meets <br className="hidden md:block" />
                                    advanced AI to accelerate your discovery.
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 }}
                                    className="flex items-center justify-center gap-6"
                                >
                                    <button
                                        onClick={() => router.push('/login')}
                                        className="group relative px-10 py-6 text-xl rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all duration-300 shadow-2xl shadow-blue-600/30 overflow-hidden"
                                    >
                                        <span className="relative z-10 flex items-center gap-3">
                                            Start Researching
                                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                </motion.div>
                            </div>
                        </section>

                        {/* Bento Grid Section */}
                        <section className="px-6 py-32 max-w-[90rem] mx-auto">
                            <FadeIn className="text-center mb-20">
                                <h2 className="text-4xl md:text-6xl font-serif font-medium mb-6 text-neutral-900 dark:text-white flex justify-center">
                                    <InteractiveText text="Power at your fingertips." />
                                </h2>
                                <p className="text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
                                    Everything you need to discover, analyze, and synthesize knowledge.
                                </p>
                            </FadeIn>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[800px]">
                                {/* Feature 1: AI Analysis (Large Vertical) */}
                                <BentoCard className="md:row-span-2 flex flex-col justify-between group overflow-hidden bg-gradient-to-b from-white/40 to-blue-50/20 dark:from-neutral-900/40 dark:to-blue-900/10" delay={0.1}>
                                    <div>
                                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                                            <Sparkles size={32} />
                                        </div>
                                        <h3 className="text-3xl font-serif font-medium mb-4 text-neutral-900 dark:text-white">AI Analysis</h3>
                                        <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed">
                                            Instantly process thousands of papers. Extract methodology, results, and insights with a single click using our advanced LLM pipeline.
                                        </p>
                                    </div>
                                    <div className="relative h-64 mt-8 rounded-2xl bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="space-y-3 w-3/4 opacity-60">
                                                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full w-full animate-pulse" />
                                                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full w-5/6 animate-pulse delay-100" />
                                                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full w-4/6 animate-pulse delay-200" />
                                            </div>
                                        </div>
                                    </div>
                                </BentoCard>

                                {/* Feature 2: Knowledge Graph (Wide Horizontal) */}
                                <BentoCard className="md:col-span-2 flex flex-col md:flex-row gap-8 items-center bg-gradient-to-br from-indigo-50/30 to-purple-50/30 dark:from-indigo-900/10 dark:to-purple-900/10" delay={0.2}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                <Share2 size={24} />
                                            </div>
                                            <div className="px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800 text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                                                Interactive
                                            </div>
                                        </div>
                                        <h3 className="text-3xl font-serif font-medium mb-4 text-neutral-900 dark:text-white">Knowledge Graphs</h3>
                                        <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                                            Visualize the invisible connections. See how citations, authors, and concepts interlink in real-time dynamic 3D graphs.
                                        </p>
                                    </div>
                                    <div className="flex-1 w-full h-64 md:h-full rounded-2xl bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 overflow-hidden relative group-hover:shadow-2xl transition-all duration-500">
                                        {/* Abstract Graph Visualization UI placeholder */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                            <Users className="w-32 h-32 text-purple-500/20" />
                                        </div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl animate-pulse" />
                                    </div>
                                </BentoCard>

                                {/* Feature 3: Global Data */}
                                <BentoCard delay={0.3}>
                                    <Globe className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-6" />
                                    <h3 className="text-2xl font-serif font-medium mb-3 text-neutral-900 dark:text-white">Global Database</h3>
                                    <p className="text-neutral-600 dark:text-neutral-400">
                                        Access peer-reviewed journals, patents, and preprints from every major publisher.
                                    </p>
                                </BentoCard>

                                {/* Feature 4: Collaboration */}
                                <BentoCard delay={0.4} className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                                    <Users className="w-10 h-10 mb-6 text-neutral-400 dark:text-neutral-500" />
                                    <h3 className="text-2xl font-serif font-medium mb-3">Team Sync</h3>
                                    <p className="text-neutral-400 dark:text-neutral-600">
                                        Real-time collaboration for labs and research groups. Share annotations instantly.
                                    </p>
                                </BentoCard>
                            </div>
                        </section>

                        {/* CTA Section */}
                        <section className="py-32 px-6">
                            <div className="max-w-5xl mx-auto text-center">
                                <FadeIn>
                                    <div className="flex justify-center mb-8">
                                        <VenaliumLoading className="text-neutral-900 dark:text-white" />
                                    </div>
                                    <h2 className="text-5xl md:text-7xl font-serif font-medium mb-8 text-neutral-900 dark:text-white tracking-tight flex justify-center">
                                        <InteractiveText text="Start your journey." />
                                    </h2>
                                    <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-12 max-w-2xl mx-auto">
                                        Join thousands of researchers who are accelerating the pace of scientific discovery.
                                    </p>
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                                        <button
                                            onClick={() => router.push('/login')}
                                            className="px-12 py-6 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-lg font-medium hover:scale-105 transition-transform duration-300 shadow-xl"
                                        >
                                            Get Started Now
                                        </button>
                                        <button
                                            className="px-12 py-6 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white text-lg font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-300"
                                        >
                                            View Demo
                                        </button>
                                    </div>
                                </FadeIn>
                            </div>
                        </section>

                        {/* Footer */}
                        <footer className="py-12 border-t border-neutral-200 dark:border-neutral-800">
                            <div className="max-w-[90rem] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-neutral-500">
                                <p>© 2025 Venalium Research. All rights reserved.</p>
                                <div className="flex items-center gap-8">
                                    <a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Privacy</a>
                                    <a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Terms</a>
                                    <a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">Contact</a>
                                </div>
                            </div>
                        </footer>
                    </div>
                </DotPatternBackground>
            </main>
        </div>
    );
}
