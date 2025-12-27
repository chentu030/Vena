import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { ExternalLink, BookOpen } from 'lucide-react';
import { usePapers } from '@/context/PaperContext';

export const CitationComponent: React.FC<NodeViewProps> = ({ node, selected }) => {
    const { index } = node.attrs;
    const { papers } = usePapers();
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const spanRef = useRef<HTMLSpanElement>(null);

    // Now each node has a single index (e.g., "39" not "39, 81")
    const idx = parseInt(String(index).trim());

    // Resolve paper from context (1-based index)
    const paper = !isNaN(idx) && papers[idx - 1]
        ? papers[idx - 1]
        : { title: node.attrs.title || 'Unknown Title', doi: node.attrs.doi };

    const updateTooltipPosition = () => {
        if (spanRef.current) {
            const rect = spanRef.current.getBoundingClientRect();
            // Position above the element, centered
            setTooltipPosition({
                top: rect.top - 8, // 8px gap above
                left: rect.left + rect.width / 2
            });
        }
    };

    const handleMouseEnter = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        updateTooltipPosition();
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        // Delay hiding to allow mouse to move to tooltip
        hideTimeoutRef.current = setTimeout(() => {
            setShowTooltip(false);
        }, 200);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (paper.doi) {
            const url = paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`;
            window.open(url, '_blank');
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    const tooltipContent = showTooltip && typeof document !== 'undefined' ? createPortal(
        <div
            className="fixed w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl p-3 z-[99999] pointer-events-auto"
            style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: 'translate(-50%, -100%)'
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="flex items-start gap-2 mb-2">
                <BookOpen size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span className="text-xs font-semibold text-foreground leading-tight line-clamp-3">{paper.title}</span>
            </div>

            {paper.doi && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded mb-2 font-mono break-all">
                    <span>DOI: {paper.doi}</span>
                </div>
            )}

            <a
                href={paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
                View Source <ExternalLink size={10} />
            </a>

            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white dark:border-t-neutral-900"></div>
        </div>,
        document.body
    ) : null;

    return (
        <NodeViewWrapper className="inline-block align-middle mx-0.5 relative">
            <span
                ref={spanRef}
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold cursor-pointer transition-all border
                    ${selected ? 'ring-2 ring-blue-500 scale-110' : ''}
                    ${paper.doi ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-neutral-500 text-white border-neutral-600 hover:bg-neutral-600'}
                `}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {index}
            </span>

            {tooltipContent}
        </NodeViewWrapper>
    );
};
