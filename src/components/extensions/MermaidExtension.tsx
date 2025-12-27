
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Network } from 'lucide-react';

const MermaidBlock = (props: any) => {
    const { node, updateAttributes, extension } = props;
    const [source, setSource] = useState(node.attrs.src || 'graph TD;\nA-->B;');
    const [svg, setSvg] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
        });
    }, []);

    // Render diagram when source changes
    useEffect(() => {
        const renderDiagram = async () => {
            if (!source.trim()) {
                console.log("Mermaid source empty");
                return;
            };

            console.log("Rendering Mermaid:", source.substring(0, 30));

            try {
                // Generate a unique ID for this diagram
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

                // Sanitize source: decode entities & remove markdown fences
                // Sanitize source: decode entities & remove markdown fences
                let cleanSource = source
                    .replace(/&gt;/g, '>')
                    .replace(/&lt;/g, '<')
                    .replace(/&amp;/g, '&')
                    .trim(); // Trim first to handle whitespace around fences

                // Remove start fence (```mermaid or ```)
                cleanSource = cleanSource.replace(/^```(?:mermaid)?\s*/i, '');

                // Remove end fence (```)
                cleanSource = cleanSource.replace(/\s*```$/, '');

                cleanSource = cleanSource.trim();

                const { svg } = await mermaid.render(id, cleanSource);
                console.log("Mermaid render success", svg.substring(0, 30));
                setSvg(svg);
                setError('');
            } catch (e: any) {
                console.error("Mermaid Render Error", e);
                setError(e.message || "Invalid Syntax");
            }
        };

        // Debounce render
        const timer = setTimeout(renderDiagram, 500);
        return () => clearTimeout(timer);
    }, [source]);


    const handleBlur = () => {
        updateAttributes({ src: source });
        setIsEditing(false);
    }

    return (
        <NodeViewWrapper className="mermaid-component my-4">
            <div className="relative border border-transparent hover:border-border rounded p-2 group transition-all">
                {/* View Mode */}
                {!isEditing && (
                    <div className="flex flex-col items-center justify-center min-h-[50px] cursor-pointer bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-4"
                        onDoubleClick={() => setIsEditing(true)}>

                        {error ? (
                            <div className="text-red-500 text-sm font-mono p-2 bg-red-50 dark:bg-red-900/20 rounded w-full overflow-x-auto">
                                <p className="font-bold mb-1">Mermaid Syntax Error:</p>
                                {error}
                                <pre className="mt-2 text-xs text-neutral-500">{source}</pre>
                            </div>
                        ) : (
                            svg ? (
                                <div dangerouslySetInnerHTML={{ __html: svg }} className="w-full flex justify-center overflow-x-auto" />
                            ) : (
                                <div className="text-neutral-400 flex items-center gap-2">
                                    <Network size={16} /> Rendering Diagram...
                                </div>
                            )
                        )}

                        {/* Overlay Controls */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-white dark:bg-neutral-800 shadow-sm border border-border px-2 py-1 text-xs rounded hover:bg-neutral-100 text-neutral-600 dark:text-neutral-300"
                            >
                                Edit Diagram
                            </button>
                        </div>
                    </div>
                )}

                {/* Edit Mode */}
                {isEditing && (
                    <div className="flex flex-col gap-2 bg-white dark:bg-neutral-900 border border-blue-500 rounded-lg shadow-lg p-2 z-10 relative">
                        <div className="flex justify-between items-center pb-1 border-b border-border/50">
                            <span className="text-xs font-bold text-blue-600 flex items-center gap-1"><Network size={12} /> Mermaid Editor</span>
                            <button onClick={handleBlur} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Done</button>
                        </div>
                        <textarea
                            className="w-full h-32 text-sm font-mono bg-neutral-50 dark:bg-neutral-950 p-2 focus:outline-none resize-y border border-neutral-200 dark:border-neutral-700 rounded"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="graph TD; A-->B;"
                            autoFocus
                        />
                        <div className="text-[10px] text-neutral-400 flex justify-between">
                            <span>Supports Flowcharts, Sequence, Gantt, etc.</span>
                            <a href="https://mermaid.js.org/intro/" target="_blank" className="hover:underline">Docs</a>
                        </div>
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export const MermaidExtension = Node.create({
    name: 'mermaid',
    group: 'block',
    atom: true, // It is a block node that doesn't contain other nodes

    addAttributes() {
        return {
            src: {
                default: 'graph TD;\nStart-->End;',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="mermaid"]',
            },
            {
                tag: 'pre.mermaid', // Support matching standard markdown fence if Tiptap parses it as code block first?
                // Actually Tiptap Markdown parser usually outputs code blocks. 
                // We might need input rules to auto-convert ```mermaid to this node.
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MermaidBlock);
    },

    addInputRules() {
        // Find a way to detect ```mermaid ... ```
        return [
            // This is tricky with multiline. Usually easiest to handle via CodeBlock language detection or a custom command.
        ];
    }
});
