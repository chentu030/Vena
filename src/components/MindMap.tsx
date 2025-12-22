import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTheme } from 'next-themes';

interface MindMapProps {
    chart: string;
}

const MindMap: React.FC<MindMapProps> = ({ chart }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: theme === 'dark' ? 'dark' : 'neutral',
            securityLevel: 'loose',
            fontFamily: 'Inter',
        });
    }, [theme]);

    // Re-render when theme or chart changes
    useEffect(() => {
        if (ref.current && chart) {
            ref.current.innerHTML = '';
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            try {
                // Need to re-initialize for theme change to take full effect dynamically sometimes
                mermaid.initialize({
                    startOnLoad: true,
                    theme: theme === 'dark' ? 'dark' : 'neutral',
                });
                mermaid.render(id, chart).then(result => {
                    if (ref.current) ref.current.innerHTML = result.svg;
                });
            } catch (e) {
                console.error("Mermaid render error", e);
            }
        }
    }, [chart, theme]);

    return (
        <div className="my-6 card p-6 overflow-x-auto bg-[var(--bg-primary)] border-[var(--border)]">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-[var(--fg-secondary)] flex items-center">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                Mind Map
            </h3>
            <div ref={ref} className="flex justify-center"></div>
        </div>
    );
};

export default MindMap;
