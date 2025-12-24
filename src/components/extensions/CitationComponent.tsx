
import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { ExternalLink, BookOpen } from 'lucide-react';

export const CitationComponent: React.FC<NodeViewProps> = ({ node, selected }) => {
    const { index, title, doi, abstract } = node.attrs;
    const [showTooltip, setShowTooltip] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (doi) {
            const url = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
            window.open(url, '_blank');
        } else {
            // Fallback search
            window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`, '_blank');
        }
    };

    return (
        <NodeViewWrapper className="inline-block align-middle mx-1 relative z-10">
            <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold cursor-pointer transition-all border
                    ${selected ? 'ring-2 ring-blue-500 scale-110' : ''}
                    ${doi ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-neutral-500 text-white border-neutral-600 hover:bg-neutral-600'}
                `}
                onClick={handleClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {index}
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl p-3 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <div className="flex items-start gap-2 mb-2">
                        <BookOpen size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-xs font-semibold text-foreground leading-tight line-clamp-3">{title || 'Unknown Title'}</span>
                    </div>

                    {doi && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded mb-2 font-mono break-all">
                            <span>DOI: {doi}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                        Click to view source <ExternalLink size={10} />
                    </div>

                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white dark:border-t-neutral-900"></div>
                </div>
            )}
        </NodeViewWrapper>
    );
};
