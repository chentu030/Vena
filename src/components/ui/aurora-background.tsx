"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
    children: ReactNode;
    showRadialGradient?: boolean;
}

export const AuroraBackground = ({
    className,
    children,
    showRadialGradient = true,
    ...props
}: AuroraBackgroundProps) => {
    return (
        <main
            className={cn(
                "relative flex flex-col h-[100vh] items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-slate-950 transition-bg overflow-hidden",
                className
            )}
            {...props}
        >
            {/* Aurora Effect Layer - z-0 */}
            <div className="absolute inset-0 overflow-hidden z-0">
                <div
                    className={cn(
                        `
            [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#a855f7_15%,#9333ea_20%,#c084fc_25%,#3b82f6_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,_50%_50%]
            filter blur-[10px] invert dark:invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] 
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%] 
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-50`,
                        showRadialGradient &&
                        `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`
                    )}
                ></div>
            </div>

            {/* Marquee Text Layer - z-1 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-[1] flex flex-col justify-between py-[10vh]">
                {/* Top Line - Moving Left */}
                <div className="whitespace-nowrap animate-marquee-left opacity-[0.04]">
                    <span className="text-[10rem] font-bold font-serif text-neutral-900 dark:text-white tracking-tight">
                        KNOWLEDGE · NEXUS · DATA · INTELLIGENCE · KNOWLEDGE · NEXUS · DATA · INTELLIGENCE · KNOWLEDGE · NEXUS · DATA · INTELLIGENCE ·
                    </span>
                </div>
                {/* Bottom Line - Moving Right */}
                <div className="whitespace-nowrap animate-marquee-right opacity-[0.04]">
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
                .animate-marquee-left {
                    animation: marquee-left 30s linear infinite;
                }
                .animate-marquee-right {
                    animation: marquee-right 40s linear infinite;
                }
            `}</style>
        </main>
    );
};
