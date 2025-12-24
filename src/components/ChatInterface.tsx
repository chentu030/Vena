import React, { useRef, useEffect, useState } from 'react';
import { Send, User, Sparkles, ArrowUp, ChevronDown, Paperclip, X, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import ArticleList from './ArticleList';

import Link from 'next/link';

export interface Message {
    role: string;
    content: string;
}

interface ResearchArticle {
    id: string;
    title: string;
    pdfUrl?: string; // Google Drive PDF URL
    abstract?: string;
    authors?: string;
    year?: string;
    // ... potentially other fields
}

interface ResearchGroup {
    id: string;
    name: string;
    papers: ResearchArticle[];
}

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (msg: string, model: string, fileContent?: string, fileName?: string, referencedGroups?: string[]) => void;
    isLoading: boolean;
    articles?: any[];
    onAddToContext?: (article: any) => void;
    researchGroups?: ResearchGroup[];
    currentGroupId?: string | null;
}

const GEMINI_MODELS = [
    { id: 'gemini-2.0-flash', name: '2.0 Flash', desc: '快速' },
    { id: 'gemini-2.0-flash-lite', name: '2.0 Flash Lite', desc: '輕量' },
    { id: 'gemini-2.5-flash', name: '2.5 Flash', desc: '推薦' },
    { id: 'gemini-2.5-flash-lite', name: '2.5 Flash Lite', desc: '輕量' },
    { id: 'gemini-2.5-pro', name: '2.5 Pro', desc: '強力' },
    { id: 'gemini-3-flash-preview', name: '3.0 Flash', desc: '預覽' },
    { id: 'gemini-3-pro-preview', name: '3.0 Pro', desc: '最新' },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, articles, onAddToContext, researchGroups = [], currentGroupId }) => {
    const [input, setInput] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showResults, setShowResults] = useState(true);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
    const [contextData, setContextData] = useState<{ type: 'group' | 'paper' | 'pdf'; name: string; content: string; id: string; pdfUrl?: string }[]>([]);

    // Mention State - Updated for @, #, ##
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionType, setMentionType] = useState<null | '@' | '#' | '##'>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionCursorIndex, setMentionCursorIndex] = useState(0);

    const bottomRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, articles]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentModel = GEMINI_MODELS.find(m => m.id === selectedModel) || GEMINI_MODELS[0];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setUploadedFile({ name: file.name, content });
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);
        const cursorPos = e.target.selectionStart || 0;

        // Check for mention patterns: @, #, or ##
        const textBeforeCursor = val.substring(0, cursorPos);

        // Check for ## first (more specific pattern)
        const doublePoundMatch = textBeforeCursor.match(/(##)(\S*)$/);
        // Then check for single # (but not ##)
        const singlePoundMatch = textBeforeCursor.match(/(?<!#)(#)(\S*)$/);
        // Then check for @
        const atMatch = textBeforeCursor.match(/(@)(\S*)$/);

        if (doublePoundMatch) {
            setMentionType('##');
            setMentionQuery(doublePoundMatch[2]);
            setShowMentionList(true);
        } else if (singlePoundMatch && !textBeforeCursor.endsWith('##')) {
            // Make sure we're not in the middle of typing ##
            const beforeHash = textBeforeCursor.slice(0, -singlePoundMatch[0].length);
            if (!beforeHash.endsWith('#')) {
                setMentionType('#');
                setMentionQuery(singlePoundMatch[2]);
                setShowMentionList(true);
            } else {
                // User is typing ##, wait for more input
                setShowMentionList(false);
                setMentionType(null);
            }
        } else if (atMatch) {
            setMentionType('@');
            setMentionQuery(atMatch[2]);
            setShowMentionList(true);
        } else {
            setShowMentionList(false);
            setMentionType(null);
        }
    };

    const handleSelectMention = (item: any) => {
        if (!mentionType) return;

        let name = '';
        let content = '';
        let id = item.id;
        let type: 'group' | 'paper' | 'pdf' = 'group';
        let pdfUrl = '';

        if (mentionType === '@') {
            // Group -> Reference database
            type = 'group';
            name = item.name;
            content = ''; // Group ID will be passed separately
        } else if (mentionType === '#') {
            // Paper -> Just metadata (title, abstract, DOI)
            type = 'paper';
            name = item.title;
            content = `[Paper Reference: ${item.title}]\nDOI: ${item.doi || 'N/A'}\nAbstract: ${item.abstract || 'No abstract available'}\n`;
        } else if (mentionType === '##') {
            // Paper with PDF -> Will send actual PDF to Gemini
            type = 'pdf';
            name = item.title;
            pdfUrl = item.pdfUrl || '';
            content = `[PDF Document: ${item.title}]\nWill analyze the full PDF content.\n`;
        }

        setContextData(prev => [...prev, { type, name, content, id, pdfUrl }]);

        // Remove the mention trigger from input
        const cursorPos = inputRef.current?.selectionStart || 0;
        const textBeforeCursor = input.substring(0, cursorPos);
        const triggerPattern = mentionType === '##' ? /(##)(\S*)$/ : mentionType === '#' ? /(#)(\S*)$/ : /(@)(\S*)$/;
        const match = textBeforeCursor.match(triggerPattern);

        if (match && match.index !== undefined) {
            const newVal = input.substring(0, match.index) + input.substring(cursorPos);
            setInput(newVal);
        }

        setShowMentionList(false);
        setMentionType(null);
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let finalInput = input;
        let finalFileContent = uploadedFile?.content;

        // Separate by type
        const groupContexts = contextData.filter(c => c.type === 'group');
        const paperContexts = contextData.filter(c => c.type === 'paper');
        const pdfContexts = contextData.filter(c => c.type === 'pdf');

        // Combine paper metadata context
        if (paperContexts.length > 0) {
            const contexts = paperContexts.map(c => c.content).join('\n\n=================\n\n');
            finalFileContent = (finalFileContent ? finalFileContent + '\n\n' : '') + contexts;
        }

        // For PDF contexts, we'll pass the PDF URLs to be fetched and sent to Gemini
        // The actual PDF handling will be done in the parent component
        const pdfUrls = pdfContexts.filter(c => c.pdfUrl).map(c => ({ id: c.id, name: c.name, url: c.pdfUrl! }));

        // Collect Group IDs
        const referencedGroups = groupContexts.map(g => g.id);

        if (finalInput.trim() || finalFileContent || referencedGroups.length > 0 || pdfUrls.length > 0) {
            // Pass PDF info along with the message
            const pdfInfo = pdfUrls.length > 0 ? `\n[PDF FILES TO ANALYZE: ${pdfUrls.map(p => p.name).join(', ')}]` : '';

            onSendMessage(
                finalInput + pdfInfo,
                selectedModel,
                finalFileContent,
                uploadedFile?.name || (paperContexts.length > 0 ? "Context_Data.txt" : undefined),
                referencedGroups
            );
            setInput('');
            setUploadedFile(null);
            setContextData([]);
        }
    };

    const getMentionListItems = () => {
        const query = mentionQuery?.toLowerCase() || '';

        if (mentionType === '@') {
            // Filter groups for @ (database)
            return researchGroups.filter(g => (g.name || '').toLowerCase().includes(query));
        } else if (mentionType === '#') {
            // # = Paper metadata - show ALL papers (with or without PDF)
            const allPapers = researchGroups.flatMap(g => g.papers || []);
            return allPapers.filter(p => p && (p.title || '').toLowerCase().includes(query));
        } else if (mentionType === '##') {
            // ## = Papers with PDF only (will send actual PDF to Gemini)
            const allPapers = researchGroups.flatMap(g => g.papers || []);
            const pdfPapers = allPapers.filter(p => p && p.pdfUrl);
            return pdfPapers.filter(p => (p.title || '').toLowerCase().includes(query));
        }
        return [];
    };

    const mentionItems = getMentionListItems();

    const SearchResults = (
        articles && articles.length > 0 ? (
            <div className="ml-14 mb-6 animate-fade-in">
                <button
                    onClick={() => setShowResults(!showResults)}
                    className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground uppercase tracking-widest font-medium transition-colors group"
                >
                    <div className={`w-2 h-2 rounded-full transition-colors ${showResults ? 'bg-blue-500' : 'bg-neutral-400'}`}></div>
                    Search Results ({articles.length})
                    <ChevronDown size={14} className={`transition-transform ${showResults ? 'rotate-180' : ''}`} />
                </button>

                {showResults && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <ArticleList articles={articles} onAddToContext={onAddToContext!} />
                    </div>
                )}
            </div>
        ) : null
    );

    return (

        <div className="flex flex-col flex-1 w-full min-h-[70vh] items-center">
            <div className="flex-1 w-full max-w-3xl px-6 md:px-8 pt-10 space-y-8 pb-32">
                {messages.map((msg, idx) => (
                    <React.Fragment key={idx}>
                        {/* Show Search Results above the last AI message */}
                        {idx === messages.length - 1 && msg.role !== 'user' && msg.role !== 'system' && SearchResults}

                        <div className={`flex gap-6 animate-fade-in ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role !== 'user' && msg.role !== 'system' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-200 to-white dark:from-neutral-800 dark:to-neutral-900 border border-white/50 flex items-center justify-center shadow-sm shrink-0">
                                    <Sparkles size={14} className="text-black dark:text-white" />
                                </div>
                            )}

                            <div className={`relative max-w-[85%] text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-neutral-100 dark:bg-neutral-800 px-5 py-3 rounded-2xl rounded-tr-sm text-foreground' : 'text-foreground'}`}>
                                {msg.role === 'system' ? (
                                    <span className="text-xs uppercase tracking-wider text-muted-foreground border border-border px-3 py-1 rounded-full">{msg.content}</span>
                                ) : msg.role === 'user' ? (
                                    <div className="whitespace-pre-wrap font-light">{msg.content}</div>
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none font-light">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center shadow-sm shrink-0">
                                    <User size={14} className="text-white dark:text-black" />
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                ))}

                {/* Show Search Results if waiting for AI response */}
                {articles && articles.length > 0 && (messages.length === 0 || messages[messages.length - 1].role === 'user') && SearchResults}

                {isLoading && (
                    <div className="flex items-center gap-4 text-muted-foreground text-sm pl-14">
                        <span className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></span>
                        </span>
                        <span className="opacity-70">Thinking...</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <form
                onSubmit={handleSubmit}
                className="sticky bottom-6 z-30 mx-auto w-full max-w-3xl px-6 md:px-8 mt-auto"
            >
                {/* Uploaded File + Context Preview */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {uploadedFile && (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
                            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                            <span className="max-w-[150px] truncate text-blue-700 dark:text-blue-300">{uploadedFile.name}</span>
                            <button type="button" onClick={() => setUploadedFile(null)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded">
                                <X size={14} className="text-blue-600 dark:text-blue-400" />
                            </button>
                        </div>
                    )}
                    {contextData.map((ctx, idx) => {
                        const colorClass = ctx.type === 'group'
                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300'
                            : ctx.type === 'paper'
                                ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300'
                                : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
                        const symbol = ctx.type === 'group' ? '@' : ctx.type === 'paper' ? '#' : '##';
                        const label = ctx.type === 'group' ? '資料庫' : ctx.type === 'paper' ? '文獻' : 'PDF';

                        return (
                            <div key={idx} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${colorClass}`}>
                                <span className="font-bold text-xs">{symbol}</span>
                                <span className="max-w-[120px] truncate font-medium">{ctx.name}</span>
                                <span className="text-[10px] opacity-60">{label}</span>
                                <button type="button" onClick={() => setContextData(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-black/5 rounded ml-auto">
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Mention List Dropdown */}
                {showMentionList && mentionItems.length > 0 && (
                    <div className="absolute bottom-full left-6 mb-2 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl py-2 min-w-[300px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                            {mentionType === '@' && '@ 資料庫'}
                            {mentionType === '#' && '# 文獻 (元資料)'}
                            {mentionType === '##' && '## 文獻 (含 PDF)'}
                        </div>
                        {mentionItems.map((item: any) => {
                            const iconColor = mentionType === '@'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200'
                                : mentionType === '#'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200'
                                    : 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200';

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectMention(item)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                                >
                                    <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${iconColor}`}>
                                        {mentionType}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.name || item.title}</div>
                                        {item.papers && <div className="text-xs text-muted-foreground">{item.papers.length} papers</div>}
                                        {item.year && <div className="text-xs text-muted-foreground">{item.year} • {item.doi ? 'DOI available' : 'No DOI'}</div>}
                                        {mentionType === '##' && item.pdfUrl && <div className="text-xs text-green-600 dark:text-green-400">✓ PDF 可用</div>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-2xl shadow-black/5 p-2 flex items-center transition-all focus-within:ring-2 ring-black/5 dark:ring-white/5">

                        {/* Model Selector */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors whitespace-nowrap"
                            >
                                <Sparkles size={12} />
                                {currentModel.name}
                                <ChevronDown size={12} className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-xl py-1 min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    {GEMINI_MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between gap-2 ${selectedModel === model.id ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}`}
                                        >
                                            <span className={selectedModel === model.id ? 'font-medium' : ''}>{model.name}</span>
                                            <span className="text-[10px] text-muted-foreground bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{model.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mind Map Quick Action for Data Groups */}
                        {contextData.some(c => c.type === 'group') && (
                            <button
                                type="button"
                                onClick={() => {
                                    const groups = contextData.filter(c => c.type === 'group').map(g => g.id);
                                    if (groups.length > 0) {
                                        // If user typed something (e.g., "Categorize by Theory"), use it. 
                                        // Otherwise use default message.
                                        const msg = input.trim() || "請為選定的資料庫建立心智圖，分析研究方法與趨勢。";

                                        onSendMessage(msg, selectedModel, undefined, undefined, groups);
                                        setInput('');
                                        setUploadedFile(null);
                                        setContextData([]);
                                    }
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-full transition-all shadow-sm animate-in fade-in zoom-in duration-200"
                            >
                                <span className="text-xs">🧠 建立心智圖</span>
                            </button>
                        )}

                        {/* Article Generation Quick Action for Data Groups */}
                        {contextData.some(c => c.type === 'group') && (
                            <button
                                type="button"
                                onClick={() => {
                                    const groups = contextData.filter(c => c.type === 'group').map(g => g.id);
                                    if (groups.length > 0) {
                                        const msg = "撰寫研究方法與理論架構文章 (Draft Research Methods & Theoretical Framework)";
                                        onSendMessage(msg, 'gemini-3-pro-preview', undefined, undefined, groups);
                                        setInput('');
                                        setUploadedFile(null);
                                        setContextData([]);
                                    }
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-full transition-all shadow-sm animate-in fade-in zoom-in duration-200"
                            >
                                <span className="text-xs">📝 撰寫研究方法與理論</span>
                            </button>
                        )}

                        <input
                            ref={inputRef}
                            className="flex-1 bg-transparent border-none outline-none px-4 text-foreground placeholder-muted-foreground font-light text-base"
                            placeholder={uploadedFile ? "詢問關於這個檔案..." : "@資料庫 #文獻 ##文獻PDF"}
                            value={input}
                            onChange={handleInputChange}
                            disabled={isLoading}
                        />

                        {/* File Upload Button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.md,.json,.csv,.xml,.html,.js,.ts,.py,.java,.c,.cpp,.css,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-all"
                            title="Upload file"
                        >
                            <Paperclip size={18} />
                        </button>

                        <button
                            disabled={(!input.trim() && !contextData.length && !uploadedFile) || isLoading}
                            className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <ArrowUp size={20} />
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;

