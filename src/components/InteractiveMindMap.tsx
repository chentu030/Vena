import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTheme } from 'next-themes';

interface InteractiveMindMapProps {
    chart: string;
    onNodeClick: (id: string, label: string) => void;
}

const InteractiveMindMap: React.FC<InteractiveMindMapProps> = ({ chart, onNodeClick }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();

    // Initialize Mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: theme === 'dark' ? 'dark' : 'neutral',
            securityLevel: 'loose',
            fontFamily: 'Inter',
        });
    }, [theme]);

    // Render and Attach Listeners
    useEffect(() => {
        if (ref.current && chart) {
            ref.current.innerHTML = '';
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

            try {
                // Re-init for theme consistency
                mermaid.initialize({
                    startOnLoad: true,
                    theme: theme === 'dark' ? 'dark' : 'neutral',
                });

                mermaid.render(id, chart).then(result => {
                    if (ref.current) {
                        ref.current.innerHTML = result.svg;

                        // Attach Click Listeners to Nodes
                        const svg = ref.current.querySelector('svg');
                        if (svg) {
                            const nodes = svg.querySelectorAll('.node, .mindmap-node');
                            nodes.forEach((node) => {
                                // Add cursor pointer to indicate interactivity
                                (node as HTMLElement).style.cursor = 'pointer';

                                node.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    // Extract text content as label
                                    const textElement = node.querySelector('foreignObject div') || node.querySelector('text');
                                    const label = textElement?.textContent?.trim() || 'Unknown Node';

                                    // Use ID from element or generate one based on label
                                    const nodeId = node.id || `node-${label.replace(/\s+/g, '-').toLowerCase()}`;

                                    console.log('Node clicked:', nodeId, label); // Debug
                                    onNodeClick(nodeId, label);
                                });
                            });
                        }
                    }
                });
            } catch (e) {
                console.error("Mermaid render error", e);
            }
        }
    }, [chart, theme, onNodeClick]);

    return (
        <div className="w-full h-full overflow-auto bg-[var(--bg-primary)] p-4">
            <div ref={ref} className="flex justify-center min-w-full"></div>
        </div>
    );
};

export default InteractiveMindMap;
