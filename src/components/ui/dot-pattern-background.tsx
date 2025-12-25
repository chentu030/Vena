"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface DotPatternBackgroundProps extends React.HTMLProps<HTMLDivElement> {
    children: ReactNode;
}

export const DotPatternBackground = ({
    className,
    children,
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
                                className="fill-neutral-400 dark:fill-neutral-500 animate-pulse-dots"
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
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-[2] flex flex-col justify-between py-[12vh]">
                {/* Top Line - Moving Left */}
                <div className="whitespace-nowrap animate-marquee-left opacity-[0.05]">
                    <span className="text-[10rem] font-bold font-serif text-neutral-900 dark:text-white tracking-tight">
                        KNOWLEDGE · NEXUS · DATA · INTELLIGENCE · KNOWLEDGE · NEXUS · DATA · INTELLIGENCE · KNOWLEDGE · NEXUS · DATA · INTELLIGENCE ·
                    </span>
                </div>
                {/* Bottom Line - Moving Right */}
                <div className="whitespace-nowrap animate-marquee-right opacity-[0.05]">
                    <span className="text-[10rem] font-bold font-serif text-neutral-900 dark:text-white tracking-tight">
                        RESEARCH · ANALYSIS · DISCOVERY · VENALIUM · RESEARCH · ANALYSIS · DISCOVERY · VENALIUM · RESEARCH · ANALYSIS · DISCOVERY · VENALIUM ·
                    </span>
                </div>
            </div>

            {/* Content Layer - z-10 */}
            <div className="relative z-10">
                {children}
            </div>

            {/* Global Animation Styles */}
            <style jsx global>{`
                @keyframes marquee-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.33%); }
                }
                @keyframes marquee-right {
                    0% { transform: translateX(-33.33%); }
                    100% { transform: translateX(0); }
                }
                @keyframes pulse-dots {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(0.7); }
                }
                .animate-marquee-left {
                    animation: marquee-left 45s linear infinite;
                }
                .animate-marquee-right {
                    animation: marquee-right 55s linear infinite;
                }
                .animate-pulse-dots {
                    animation: pulse-dots 4s ease-in-out infinite;
                }
            `}</style>
        </main>
    );
};
