
import React, { useState, useEffect, useRef } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import mermaid from 'mermaid';
import { Eye, Code, Network, AlertTriangle, RefreshCw } from 'lucide-react';

export const CodeBlockComponent = ({ node, updateAttributes, extension }: any) => {
    const [isMermaid, setIsMermaid] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Check language on mount and update
    useEffect(() => {
        const lang = node.attrs.language;
        const content = node.textContent || '';

        // Check if it's explicitly mermaid or contains diagram keywords
        const isMermaidLang =
            lang === 'mermaid' ||
            /(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|journey|mindmap)/i.test(content);

        setIsMermaid(!!isMermaidLang);
    }, [node.attrs.language, node.textContent]);

    const renderDiagram = async () => {
        if (!node.textContent.trim()) return;

        setIsLoading(true);
        setError('');

        const tryRender = async (src: string, retryMode = false) => {
            try {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    maxTextSize: 50000,
                });

                // Pre-check: if src doesn't start with a known diagram type, allow auto-fix on first try
                const hasHeader = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|journey|mindmap|erDiagram)/i.test(src);
                let contentToRender = src;

                if (!hasHeader && !retryMode) {
                    // Start aggressive: if it looks like mermaid syntax (has arrows or subgraphs) but no header, add one
                    if (src.includes('-->') || src.includes('subgraph')) {
                        console.log("No header detected, prepending flowchart TD automatically");
                        contentToRender = `flowchart TD\n${src}`;
                    }
                }

                const id = `mermaid-preview-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, contentToRender);
                setSvg(svg);
                setError('');
                setShowPreview(true);
                return true;
            } catch (e: any) {
                console.warn("Mermaid Render Error", e);

                // Auto-fix: If error suggests missing type and we haven't retried yet
                if (!retryMode && (e.message?.includes('No diagram type detected') || e.message?.includes('Parse error'))) {
                    console.log("Attempting to auto-fix missing header...");
                    // Try prepending flowchart TD if missing
                    if (!/^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|journey|mindmap)/i.test(src)) {
                        return await tryRender(`flowchart TD\n${src}`, true);
                    }
                }

                setError(e.message || "Syntax Error");
                setShowPreview(true);
                return false;
            }
        };

        try {
            await tryRender(node.textContent.trim());
        } finally {
            setIsLoading(false);
        }
    };

    const codeContentStyle = {
        whiteSpace: 'pre-wrap',
        fontFamily: '"JetBrains Mono", monospace',
    };

    return (
        <NodeViewWrapper className="code-block-component relative my-4 group">
            {/* Header / Toolbar */}
            <div className="flex justify-between items-center bg-neutral-100 dark:bg-neutral-800 rounded-t-lg px-4 py-2 border border-neutral-200 dark:border-neutral-700 border-b-0 select-none">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-500 uppercase">{node.attrs.language || 'text'}</span>
                    {isMermaid && (
                        <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                            <Network size={10} /> Diagram
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isMermaid && (
                        <button
                            onClick={() => showPreview ? setShowPreview(false) : renderDiagram()}
                            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition w-28 justify-center"
                            type="button"
                        >
                            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : (showPreview ? <Code size={12} /> : <Eye size={12} />)}
                            {isLoading ? 'Rendering...' : (showPreview ? 'Edit Code' : 'Render View')}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            const content = node.textContent;
                            navigator.clipboard.writeText(content);
                        }}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                        title="Copy code"
                    >
                        <code className="text-[10px]">Copy</code>
                    </button>
                </div>
            </div>

            <div className="relative">
                {/* Code Editor Area */}
                <pre
                    className={`
                bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-b-lg p-4 overflow-x-auto
                ${showPreview ? 'hidden' : 'block'}
            `}
                >
                    <code className="text-neutral-800 dark:text-neutral-200 text-sm" style={codeContentStyle}>
                        <NodeViewContent />
                    </code>
                </pre>

                {/* Preview Area */}
                {showPreview && (
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-b-lg p-6 min-h-[150px] flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
                        {error ? (
                            <div className="text-red-500 text-sm font-mono w-full">
                                <div className="flex items-center gap-2 mb-2 font-bold border-b border-red-200 pb-2">
                                    <AlertTriangle size={16} />
                                    Rendering Failed
                                </div>
                                <p className="whitespace-pre-wrap">{error}</p>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="mt-4 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 px-3 py-1.5 rounded hover:bg-red-200"
                                >
                                    Return to Code
                                </button>
                            </div>
                        ) : (
                            <div className="w-full overflow-x-auto flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
                        )}
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};
