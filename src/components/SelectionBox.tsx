
import React from 'react';

interface SelectionBoxProps {
    start: { x: number; y: number } | null;
    current: { x: number; y: number } | null;
}

export default function SelectionBox({ start, current }: SelectionBoxProps) {
    if (!start || !current) return null;

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    return (
        <div
            className="absolute border border-blue-500 bg-blue-500/20 z-50 pointer-events-none"
            style={{
                left,
                top,
                width,
                height,
            }}
        />
    );
}
