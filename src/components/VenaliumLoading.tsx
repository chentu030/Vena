'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface VenaliumLoadingProps {
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

export default function VenaliumLoading({ size = 'medium', className = '' }: VenaliumLoadingProps) {
    const scale = size === 'small' ? 0.5 : size === 'large' ? 1.5 : 1;
    const baseSize = 100 * scale;
    const filterId = React.useId(); // Unique ID for this instance's filter

    const r = 14;
    const dur = 2.5; // Faster cycle as requested

    // Exact Coordinates
    const L = { x: 25, y: 35 }; // Moved further out and up
    const B = { x: 50, y: 78 }; // Moved further down (approx equilateral height)
    const R = { x: 75, y: 35 }; // Moved further out and up
    const MID = { x: 50, y: 56 }; // Centered midpoint

    const BRIDGE_POS = { x: 37.5, y: 56.5 }; // Midpoint between L and B

    return (
        <div className={`flex items-center justify-center ${className}`} style={{ width: baseSize, height: baseSize }}>
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <defs>
                    <filter id={filterId}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" /> {/* Increased blur for stronger merge */}
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" result="goo" />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>

                {/* GROUP 1: EXPLODERS (L, B & BRIDGE) */}
                <motion.circle
                    cx={L.x} cy={L.y} r={r} fill="currentColor" className="text-black dark:text-white"
                    animate={{
                        opacity: [1, 0, 0],
                        scale: [1, 0, 0],
                        x: [0, -25, -25],
                        y: [0, -25, -25],
                    }}
                    transition={{ duration: dur, repeat: Infinity, times: [0, 0.15, 1], ease: "easeOut" }}
                />
                <motion.circle
                    cx={B.x} cy={B.y} r={r} fill="currentColor" className="text-black dark:text-white"
                    animate={{
                        opacity: [1, 0, 0],
                        scale: [1, 0, 0],
                        y: [0, 35, 35],
                    }}
                    transition={{ duration: dur, repeat: Infinity, times: [0, 0.15, 1], ease: "easeOut" }}
                />
                {/* Visual Bridge Element for Exploders phase - Capsule like using large radius overlapping */}
                <motion.circle
                    cx={BRIDGE_POS.x} cy={BRIDGE_POS.y} r={r * 0.6} fill="currentColor" className="text-black dark:text-white"
                    animate={{
                        opacity: [1, 0, 0],
                        scale: [1, 0, 0],
                    }}
                    transition={{ duration: dur, repeat: Infinity, times: [0, 0.15, 1], ease: "easeOut" }}
                />

                {/* GROUP 2: MOVERS (Splitters) */}
                <g filter={`url(#${filterId})`}>
                    {/* Splitter L: R -> MID -> L */}
                    <motion.circle
                        cx={R.x} cy={R.y} r={r} fill="currentColor" className="text-black dark:text-white"
                        animate={{
                            cx: [R.x, MID.x, MID.x, L.x, L.x],
                            cy: [R.y, MID.y, MID.y, L.y, L.y],
                        }}
                        transition={{
                            duration: dur,
                            repeat: Infinity,
                            times: [0, 0.25, 0.4, 0.7, 1],
                            ease: "easeInOut"
                        }}
                    />

                    {/* Splitter B: R -> MID -> B */}
                    <motion.circle
                        cx={R.x} cy={R.y} r={r} fill="currentColor" className="text-black dark:text-white"
                        animate={{
                            cx: [R.x, MID.x, MID.x, B.x, B.x],
                            cy: [R.y, MID.y, MID.y, B.y, B.y],
                        }}
                        transition={{
                            duration: dur,
                            repeat: Infinity,
                            times: [0, 0.25, 0.4, 0.7, 1],
                            ease: "easeInOut"
                        }}
                    />

                    {/* Splitter Bridge: R -> MID -> BRIDGE_POS */}
                    <motion.circle
                        cx={R.x} cy={R.y} r={Math.max(0, r * 0.6)} fill="currentColor" className="text-black dark:text-white"
                        animate={{
                            cx: [R.x, MID.x, MID.x, BRIDGE_POS.x, BRIDGE_POS.x],
                            cy: [R.y, MID.y, MID.y, BRIDGE_POS.y, BRIDGE_POS.y],
                        }}
                        transition={{
                            duration: dur,
                            repeat: Infinity,
                            times: [0, 0.25, 0.4, 0.7, 1],
                            ease: "easeInOut"
                        }}
                    />
                </g>

                {/* GROUP 3: SPAWNER (New R) */}
                {/* Appears at R after Movers leave. Stays until end. */}
                <motion.circle
                    cx={R.x} cy={R.y} r={r} fill="currentColor" className="text-black dark:text-white"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        opacity: [0, 0, 1, 1],
                        scale: [0, 0, 1, 1]
                    }}
                    transition={{ duration: dur, repeat: Infinity, times: [0, 0.35, 0.5, 1], ease: "easeOut" }}
                />
            </svg>
        </div>
    );
}
