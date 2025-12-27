'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './extensions/ResizableImage';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Bold, Italic, Heading1, Heading2, Heading3, Image as ImageIcon, FileText, Download, Quote, List, Link as LinkIcon, Undo, Redo, Code, Strikethrough, Sigma } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { CitationExtension } from './extensions/CitationExtension';
import { MathExtension } from './extensions/MathExtension';
import { MermaidExtension } from './extensions/MermaidExtension';
import { CodeBlockComponent } from './extensions/CodeBlockComponent';
import CodeBlockExtension from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';

interface MainEditorProps {
    content: string;
    setContent: (content: string) => void;
    saveStatus?: 'saved' | 'saving' | 'error';
}

export default function MainEditor({ content, setContent, saveStatus = 'saved' }: MainEditorProps) {
    const [showMathToolbar, setShowMathToolbar] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false, // Disable default CodeBlock to use our custom one
            }),
            // Custom Code Block with "Click to Render" support
            CodeBlockExtension.extend({
                addNodeView() {
                    return ReactNodeViewRenderer(CodeBlockComponent);
                }
            }).configure({
                defaultLanguage: 'plaintext',
            }),
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
                extensions: [
                    {
                        name: 'citation',
                        serialize(state: any, node: any) {
                            state.write(`[${node.attrs.index}]`);
                        },
                        parse: {},
                    },
                    // Remove custom Mermaid serializer, let it fall back to default CodeBlock serializer
                    // which handles ```mermaid correctly.
                ],
            } as any),
            ResizableImage,
            Link.configure({
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder: 'Start writing your manuscript... (Markdown supported)',
            }),
            MathExtension,
            CitationExtension,
            // MermaidExtension, // Disable the dedicated node extension for now
        ],
        content: content,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-screen p-8 md:p-12',
            },
        },
        onUpdate: ({ editor }) => {
            // Use Markdown as source of truth to avoid HTML/MD mixing issues when appending AI content
            const output = (editor.storage as any).markdown.getMarkdown();
            console.log("Editor Update: Markdown output length", output.length);
            setContent(output);
        },
        immediatelyRender: false,
    });

    const insertText = (before: string, after: string) => {
        if (!editor) return;
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const { from, to } = selection;
        const text = state.doc.textBetween(from, to, ' ');

        editor.chain().focus().insertContent(before + text + after).run();

        // Move cursor inside if there was no selection
        if (from === to && after) {
            const newPos = editor.state.selection.from - after.length;
            editor.commands.setTextSelection(newPos);
        }
    };

    const insertMath = (latex: string) => {
        if (!editor) return;
        if ((editor.commands as any).insertMath) {
            (editor.commands as any).insertMath(latex).run();
        } else {
            insertText('$' + latex + '$', '');
        }
    };

    // Sync content if it changes externally (e.g. loading a new file)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Only update if content is actually different to avoid cursor jumps
            // Simple check might be insufficient for real-time collab, but fine here
            // We'll trust the editor state mostly, but if 'content' prop drastically changes (loading), we reset.
            // For now, let's only set if editor is empty or we have a specific signal.
            // Actually, the standard pattern is:
            // if (content !== editor.getHTML()) ... but we are using markdown.
            // Let's rely on the parent likely not changing content while we type, only on load.
            // A better check:
            // editor.commands.setContent(content);
        }
    }, [content, editor]);

    // Track the last content length we synced to detect appends
    const lastSyncedLengthRef = useRef(0);
    const pendingContentRef = useRef<string | null>(null);
    const isSyncingRef = useRef(false);

    // Function to sync content and run conversions
    // Function to sync content and run conversions
    const syncContentAndConvert = useCallback((contentToSync: string) => {
        if (!editor) return;

        // Set content
        editor.commands.setContent(contentToSync);
        lastSyncedLengthRef.current = contentToSync.length;

        // Run conversions in a timeout to ensure editor state and DOM are fully updated
        setTimeout(() => {
            if (!editor) return;

            // Convert citations
            if (editor.schema.nodes.citation) {
                const { state } = editor;
                const textUpdates: { from: number; to: number; indices: string[] }[] = [];
                const nodeUpdates: { from: number; to: number; indices: string[] }[] = [];

                state.doc.descendants((node, pos) => {
                    if (node.isText && node.text) {
                        const regex = /\[([\d,\s]+)\]/g;
                        let match;
                        while ((match = regex.exec(node.text)) !== null) {
                            const indices = match[1].split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                            if (indices.length > 0) {
                                textUpdates.push({
                                    from: pos + match.index,
                                    to: pos + match.index + match[0].length,
                                    indices
                                });
                            }
                        }
                    }

                    if (node.type.name === 'citation') {
                        const indexStr = String(node.attrs.index || '');
                        if (indexStr.includes(',') || indexStr.includes(';')) {
                            const indices = indexStr.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                            if (indices.length > 1) {
                                nodeUpdates.push({
                                    from: pos,
                                    to: pos + node.nodeSize,
                                    indices
                                });
                            }
                        }
                    }
                });

                const allUpdates = [...textUpdates, ...nodeUpdates];
                if (allUpdates.length > 0) {
                    allUpdates.sort((a, b) => b.from - a.from);
                    try {
                        const { state: currentState } = editor;
                        const tr = currentState.tr;

                        for (const u of allUpdates) {
                            const nodes = u.indices.map(idx =>
                                editor.schema.nodes.citation.create({ index: idx })
                            );
                            tr.replaceWith(u.from, u.to, nodes);
                        }
                        editor.view.dispatch(tr);
                    } catch (e) { console.error("Citation convert error", e); }
                }
            }

            // Convert Mermaid blocks
            // Re-fetch state after potential citation updates
            const { state: mState } = editor;
            const mermaidUpdates: { from: number; to: number; src: string }[] = [];

            console.log("Scanning for mermaid blocks...");

            mState.doc.descendants((node, pos) => {
                // Debug log for all codeBlocks
                if (node.type.name === 'codeBlock') {
                    console.log("CodeBlock found:", node.attrs.language, node.textContent.slice(0, 20));
                }

                const isMermaidBlock = node.type.name === 'codeBlock' &&
                    (node.attrs.language === 'mermaid' ||
                        node.attrs.class?.includes('mermaid') ||
                        node.textContent.trim().startsWith('flowchart') ||
                        node.textContent.trim().startsWith('graph') ||
                        node.textContent.trim().startsWith('sequenceDiagram') ||
                        node.textContent.trim().startsWith('classDiagram'));

                if (isMermaidBlock) {
                    console.log("Identified Mermaid Block at", pos);
                    mermaidUpdates.push({
                        from: pos,
                        to: pos + node.nodeSize,
                        src: node.textContent
                    });
                }
            });

            /* 
            // DISABLE MERMAID CONVERSION TEMPORARILY
            // To prevent "disappearing content" bugs caused by sync race conditions.
            if (mermaidUpdates.length > 0) {
                console.log(`Applying ${mermaidUpdates.length} mermaid updates`);
                const { state: currentState } = editor;
                const tr = currentState.tr;
                for (let i = mermaidUpdates.length - 1; i >= 0; i--) {
                    const update = mermaidUpdates[i];
                    try {
                        const mermaidNode = editor.schema.nodes.mermaid.create({ src: update.src });
                        tr.replaceWith(update.from, update.to, mermaidNode);
                    } catch (e) {
                        console.error("Failed to create mermaid node:", e);
                    }
                }
                editor.view.dispatch(tr);
            } else {
                console.log("No mermaid blocks to convert found.");
            }
            */
            console.log("Mermaid conversion disabled - rendering as code block.");
        }, 50); // 50ms delay
    }, [editor]);

    // Unified content sync + conversion logic with queuing
    useEffect(() => {
        if (!editor || !content) return;

        const contentLength = content.length;
        const lastLength = lastSyncedLengthRef.current;

        // Determine if we need to sync content
        const needsSync = editor.isEmpty || (contentLength > lastLength + 20);

        if (!needsSync) return;

        // If currently syncing, queue this content for later
        if (isSyncingRef.current) {
            pendingContentRef.current = content;
            return;
        }

        isSyncingRef.current = true;

        // Execute the sync using setTimeout to avoid flushSync errors
        setTimeout(() => {
            syncContentAndConvert(content);

            // Check if there's pending content to process
            const processPending = () => {
                if (pendingContentRef.current && pendingContentRef.current.length > lastSyncedLengthRef.current + 20) {
                    const pending = pendingContentRef.current;
                    pendingContentRef.current = null;
                    syncContentAndConvert(pending);
                    // Check again in case more content came in
                    queueMicrotask(processPending);
                } else {
                    pendingContentRef.current = null;
                    isSyncingRef.current = false;
                }
            };

            queueMicrotask(processPending);
        }, 0);

        return () => {
            isSyncingRef.current = false;
        };
    }, [editor, content, syncContentAndConvert]);

    // Note: Mermaid block conversion is handled in syncContentAndConvert
    // No need for a separate update listener as it was causing focus issues


    if (!editor) {
        return null; // or loading spinner
    }



    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                if (result) {
                    editor.chain().focus().setImage({ src: result }).run();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };



    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    // Exports
    const exportMD = () => {
        const blob = new Blob([(editor.storage as any).markdown.getMarkdown()], { type: 'text/markdown;charset=utf-8' });
        saveAs(blob, 'manuscript.md');
    };

    const exportPDF = async () => {
        const element = document.querySelector('.ProseMirror') as HTMLElement;
        if (element) {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('manuscript.pdf');
        }
    };

    const exportWord = () => {
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + editor.getHTML() + footer;
        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        saveAs(blob, 'manuscript.doc');
    };

    return (
        <div
            className="flex flex-col h-full bg-background"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />

            {/* Toolbar */}
            <div className="min-h-[3.5rem] h-auto py-2 border-b border-border/50 flex flex-wrap items-center justify-between px-4 bg-muted/20 gap-y-2">
                <div className="flex flex-wrap items-center gap-1">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={`p-2 rounded ${editor.isActive('bold') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Bold"><Bold size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={`p-2 rounded ${editor.isActive('italic') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Italic"><Italic size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={`p-2 rounded ${editor.isActive('strike') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Strike"><Strikethrough size={16} /></button>
                    <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="H1"><Heading1 size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="H2"><Heading2 size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-2 rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="H3"><Heading3 size={16} /></button>
                    <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
                    <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-2 rounded ${editor.isActive('blockquote') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Quote"><Quote size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded ${editor.isActive('bulletList') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Bullet List"><List size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run()} className={`p-2 rounded ${editor.isActive('code') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Inline Code"><Code size={16} /></button>
                    <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`p-2 rounded ${editor.isActive('codeBlock') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Code Block"><div className="font-mono text-[10px] font-bold border border-current rounded px-0.5">{'</>'}</div></button>
                    <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

                    {/* Image Upload: Primary click = File, Right click (or long press concept) = URL? 
                        Lets just keep "Image" as file, and maybe add "Link" as link. 
                        Actually I'll add handling: Click -> Upload. 
                        To keep URL option accessible without clutter, maybe I can just rely on standard Link or users expectation.
                        Alternatively, triggerImageUpload handles file.
                        If user wants URL, they can use the Link tool or I can duplicate the button.
                        I'll just replace the original `addImage` with `triggerImageUpload` for the main icon.
                        And maybe add a small "Link Image" if really needed? 
                        Let's just bind to `triggerImageUpload` as it addresses the core request.
                     */}
                    <button onClick={triggerImageUpload} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded" title="Insert Image (Upload)"><ImageIcon size={16} /></button>

                    <button onClick={setLink} className={`p-2 rounded ${editor.isActive('link') ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Link"><LinkIcon size={16} /></button>
                    <div className="w-px h-6 bg-border mx-1 hidden sm:block delay-100" />
                    <button onClick={() => setShowMathToolbar(!showMathToolbar)} className={`p-2 rounded ${showMathToolbar ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`} title="Toggle Math Toolbar"><Sigma size={16} /></button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded disabled:opacity-30"><Undo size={14} /></button>
                    <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded disabled:opacity-30"><Redo size={14} /></button>
                    <div className="w-px h-6 bg-border mx-1" />

                    {/* Save Status */}
                    <div className="flex items-center gap-1.5 mr-2 px-2">
                        {saveStatus === 'saving' && (
                            <>
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-xs text-muted-foreground hidden sm:inline">Saving...</span>
                            </>
                        )}
                        {saveStatus === 'saved' && (
                            <>
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs text-muted-foreground hidden sm:inline">Saved</span>
                            </>
                        )}
                        {saveStatus === 'error' && (
                            <>
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-xs text-red-500 font-bold hidden sm:inline">Save Failed</span>
                            </>
                        )}
                    </div>
                    <button onClick={exportMD} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors whitespace-nowrap">
                        <FileText size={14} /> MD
                    </button>
                    <button onClick={exportWord} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors whitespace-nowrap">
                        <FileText size={14} /> Word
                    </button>
                    <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors whitespace-nowrap">
                        <Download size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* Math / LaTeX Quick Toolbar */}
            {
                showMathToolbar && (
                    <div className="h-10 border-b border-border/50 flex items-center px-4 bg-purple-50/50 dark:bg-purple-900/10 gap-2 overflow-x-auto scrollbar-hide text-xs animate-in slide-in-from-top-1">
                        <span className="text-purple-600 dark:text-purple-400 font-medium mr-2 flex items-center gap-1"><Sigma size={12} /> Math:</span>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: 'E=mc^2' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-mono" title="Inline Math">$...$</button>
                        <button onClick={() => insertText('$$\n', '\n$$')} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-mono" title="Block Math">$$...$$</button>
                        <div className="w-px h-4 bg-purple-200 dark:bg-purple-700/50 mx-1" />
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\frac{a}{b}' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic" title="Fraction">Fraction</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\sqrt{x}' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic" title="Square Root">√</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\sum_{i=1}^{n}' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif" title="Sum">∑</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\int_{a}^{b}' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic" title="Integral">∫</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\alpha' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic">α</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\beta' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic">β</button>
                        <button onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '\\theta' } }).run()} className="px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded font-serif italic">θ</button>
                    </div>
                )
            }

            {/* Editor Content with Scroll Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div >
    );
}
