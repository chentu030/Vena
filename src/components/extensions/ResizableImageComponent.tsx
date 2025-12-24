'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export default function ResizableImageComponent(props: NodeViewProps) {
    const { node, updateAttributes, selected } = props;
    const [resizing, setResizing] = useState(false);
    const [width, setWidth] = useState(node.attrs.width || 'auto');
    // We can track height if needed, but usually aspect ratio is preserved by just width OR using CSS.
    // Let's support width mainly.

    // Initial sync
    useEffect(() => {
        setWidth(node.attrs.width || 'auto');
    }, [node.attrs.width]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setResizing(true);

        const startX = e.clientX;
        const startWidth = (e.target as HTMLElement).parentElement?.querySelector('img')?.offsetWidth || 100;

        const onMouseMove = (e: MouseEvent) => {
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = Math.max(50, startWidth + diffX); // Min 50px
            setWidth(`${newWidth}px`);
        };

        const onMouseUp = (e: MouseEvent) => {
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = Math.max(50, startWidth + diffX);

            updateAttributes({ width: `${newWidth}px` });
            setResizing(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <NodeViewWrapper className="inline-block relative leading-none group">
            <img
                src={node.attrs.src}
                alt={node.attrs.alt}
                title={node.attrs.title}
                style={{
                    width: width === 'auto' ? undefined : width,
                    maxWidth: '100%',
                    display: 'block', // Block to avoid weird line-height issues
                }}
                className={`rounded-md transition-shadow ${selected || resizing ? 'shadow-[0_0_0_2px_#3b82f6]' : ''}`}
            />

            {/* Rescue Handle - visible on select or hover */}
            <div
                className={`absolute bottom-1 right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity
                ${selected ? 'opacity-100' : ''}
                `}
                onMouseDown={handleMouseDown}
            ></div>
        </NodeViewWrapper>
    );
}
