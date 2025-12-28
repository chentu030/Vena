"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface DotPatternBackgroundProps extends React.HTMLProps<HTMLDivElement> {
    children: ReactNode;
    bodyClassName?: string;
    showMarquee?: boolean; // Whether to show scrolling text background
    animateDots?: boolean; // Whether dots should pulse/animate
}

export const DotPatternBackground = ({
    className,
    children,
    bodyClassName,
    showMarquee = true,
    animateDots = true,
    ...props
}: DotPatternBackgroundProps) => {
    return (
        <main
            className={cn(
                "relative flex flex-col h-[100vh] items-center justify-center bg-white dark:bg-neutral-950 text-slate-950 transition-colors overflow-hidden",
                className
            )}
            {...props}
            suppressHydrationWarning
        >
            {/* Base Layer: Soft Color Orbs - z-0 */}
            <div className="absolute inset-0 z-0 pointer-events-none" suppressHydrationWarning>
                {/* Blue Orb (Left) - Larger and deeper */}
                <div className="absolute top-[-10%] left-[-15%] w-[800px] h-[800px] bg-blue-500/15 dark:bg-blue-600/20 rounded-full blur-[120px]" suppressHydrationWarning />
                {/* Green Orb (Right) - Larger and deeper */}
                <div className="absolute bottom-[-10%] right-[-15%] w-[800px] h-[800px] bg-emerald-500/15 dark:bg-emerald-600/20 rounded-full blur-[120px]" suppressHydrationWarning />
            </div>

            {/* Dot Pattern Layer - z-[1] (Static position but pulsing) */}
            <div className="absolute inset-0 z-[1] opacity-70">
                <svg
                    className="h-full w-full"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern
                            id="dotPattern"
                            x="0"
                            y="0"
                            width="40"
                            height="40"
                            patternUnits="userSpaceOnUse"
                        >
                            <circle
                                cx="4"
                                cy="4"
                                r="2"
                                className={`fill-neutral-400 dark:fill-neutral-500 ${animateDots ? 'animate-pulse-dots' : 'opacity-30'}`}
                            />
                        </pattern>
                        {/* Radial gradient mask for refined center focus */}
                        <radialGradient id="dotFade" cx="50%" cy="50%" r="70%">
                            <stop offset="0%" stopColor="white" stopOpacity="1" />
                            <stop offset="60%" stopColor="white" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
                        </radialGradient>
                        <mask id="dotMask">
                            <rect width="100%" height="100%" fill="url(#dotFade)" />
                        </mask>
                    </defs>
                    <rect
                        width="100%"
                        height="100%"
                        fill="url(#dotPattern)"
                        mask="url(#dotMask)"
                    />
                </svg>
            </div>

            {/* Marquee Text Layer - z-[2] */}
            {showMarquee && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-[2] flex flex-col justify-between py-[12vh]">
                    {/* Top Line - Moving Left */}
                    <div className="flex animate-marquee-left opacity-[0.05]">
                        {Array(4).fill("KNOWLEDGE · NEXUS · DATA · INTELLIGENCE · ").map((text, i) => (
                            <span key={i} className="text-[10rem] font-bold font-serif text-neutral-900 dark:text-white tracking-tight flex-shrink-0 mx-4">
                                {text}
                            </span>
                        ))}
                    </div>
                    {/* Bottom Line - Moving Right */}
                    <div className="flex animate-marquee-right opacity-[0.05]">
                        {Array(4).fill("RESEARCH · ANALYSIS · DISCOVERY · VENALIUM · ").map((text, i) => (
                            <span key={i} className="text-[10rem] font-bold font-serif text-neutral-900 dark:text-white tracking-tight flex-shrink-0 mx-4">
                                {text}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Layer - z-10 */}
            <div className={cn("relative z-10", bodyClassName)}>
                {children}
            </div>

            {/* Global Animation Styles */}
            <style jsx global>{`
                @keyframes marquee-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes marquee-right {
                    0% { transform: translateX(-50%); }
                    100% { transform: translateX(0); }
                }
                @keyframes pulse-dots {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(0.7); }
                }
                .animate-marquee-left {
                    display: flex;
                    width: max-content;
                    animation: marquee-left 120s linear infinite;
                }
                .animate-marquee-right {
                    display: flex;
                    width: max-content;
                    animation: marquee-right 120s linear infinite;
                }
                .animate-pulse-dots {
                    animation: pulse-dots 4s ease-in-out infinite;
                }
            `}</style>
        </main>
    );
};
