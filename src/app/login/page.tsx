
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const { signInWithGoogle, user, loading, error } = useAuth();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    // Mouse Tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Canvas Particles System
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const particles: Particle[] = [];
        const particleCount = 60;

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            color: string;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2 + 1;
                // Fashion colors: Blue, Purple, Black accent
                const colors = ['rgba(59, 130, 246, 0.3)', 'rgba(147, 51, 234, 0.3)', 'rgba(0, 0, 0, 0.1)'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Bounce
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse interaction repulsion
                const dx = mousePos.x - this.x;
                const dy = mousePos.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    const angle = Math.atan2(dy, dx);
                    this.x -= Math.cos(angle) * 1;
                    this.y -= Math.sin(angle) * 1;
                }
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            // Draw connections
            particles.forEach((p1, i) => {
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(150, 150, 150, ${0.1 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });

            requestAnimationFrame(animate);
        };

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        animate();
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, [mousePos]); // Re-bind if mousePos is needed in closure (or use ref for mousePos optimization)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-neutral-200 border-t-neutral-800 rounded-full animate-spin"></div>
                    <span className="text-neutral-500 font-serif italic text-sm tracking-widest">Loading Venalium...</span>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="min-h-screen w-full bg-[#FAFAFA] text-[#1A1A1A] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans"
        >

            {/* 1. Canvas Layer: Particles & Mesh */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0 pointer-events-none"
            />

            {/* 2. Spotlight Layer (Bold Interactive) */}
            <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-75 mix-blend-multiply z-0"
                style={{
                    background: `
                        radial-gradient(1000px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.08), transparent 60%),
                        radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(236, 72, 153, 0.05), transparent 50%)
                    `
                }}
            />

            {/* 3. Floating Fashion Typography Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-[0.03]">
                <div className="absolute top-[10%] -left-[10%] text-[12rem] font-bold font-serif whitespace-nowrap animate-slide-slow text-neutral-900">
                    KNOWLEDGE NEXUS DATA INTELLIGENCE
                </div>
                <div className="absolute bottom-[10%] -left-[10%] text-[12rem] font-bold font-serif whitespace-nowrap animate-slide-slow-reverse text-neutral-900">
                    RESEARCH ANALYSIS DISCOVERY VENALIUM
                </div>
                <div className="absolute top-[40%] left-[50%] -translate-x-1/2 text-[20rem] font-bold opacity-30 rotate-12 blur-3xl text-blue-200">
                    &
                </div>
            </div>


            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-lg flex flex-col items-center">

                {/* Brand Identity */}
                <div className="mb-12 text-center space-y-4">
                    <h1 className="text-7xl md:text-8xl font-serif tracking-tighter font-medium text-neutral-900 leading-none drop-shadow-2xl">
                        Venalium<span className="text-blue-600">.</span>
                    </h1>
                    <div className="flex items-center justify-center gap-4 text-xs font-medium tracking-[0.3em] uppercase text-neutral-400">
                        <span>Research</span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                        <span>Intelligence</span>
                        <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
                        <span>Future</span>
                    </div>
                </div>

                {/* Login Card - Glassy & Premium */}
                <div className="group w-full bg-white/50 backdrop-blur-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] p-8 md:p-12 flex flex-col gap-8 transition-all hover:shadow-[0_30px_80px_-20px_rgba(59,130,246,0.15)] ring-1 ring-black/5 hover:ring-black/10 hover:scale-[1.01] duration-500">

                    <div className="space-y-3 text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Sign in</h2>
                        <p className="text-neutral-500 text-sm">
                            Access your research workspace
                        </p>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={signInWithGoogle}
                        className="relative w-full h-14 bg-white text-neutral-700 border border-neutral-200 rounded-xl overflow-hidden transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98] flex items-center justify-center gap-3 group/btn"
                    >
                        <div className="flex items-center gap-3 font-medium tracking-wide">
                            <svg className="w-5 h-5 shrink-0 transition-transform group-hover/btn:scale-110 duration-300" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span>Sign in with Google</span>
                        </div>
                    </button>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs font-medium border border-red-100 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-16 text-center">
                    <p className="text-[10px] text-neutral-300 font-medium tracking-[0.5em] uppercase hover:text-neutral-500 transition-colors cursor-default">
                        EST. 2025
                    </p>
                </div>
            </div>

            <style jsx global>{`
                @keyframes slide-slow {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes slide-slow-reverse {
                    0% { transform: translateX(-50%); }
                    100% { transform: translateX(0); }
                }
                .animate-slide-slow {
                    animation: slide-slow 60s linear infinite;
                }
                .animate-slide-slow-reverse {
                    animation: slide-slow-reverse 70s linear infinite;
                }
            `}</style>
        </div>
    );
}
