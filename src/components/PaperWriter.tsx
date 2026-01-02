import React, { useState } from 'react';
import { Wand2, Download, FileText, CheckCircle2, RotateCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface PaperWriterProps {
    content: string;
    setContent: (content: string) => void;
    onAskAI: (task: string, prompt: string) => void;
    isAutoSyncEnabled: boolean;
    setIsAutoSyncEnabled: (enabled: boolean) => void;
    isUpdating: boolean;
}

export default function PaperWriter({
    content,
    setContent,
    onAskAI,
    isAutoSyncEnabled,
    setIsAutoSyncEnabled,
    isUpdating
}: PaperWriterProps) {
    // const { t } = useLanguage(); 

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950 font-serif">
            <div className="h-14 flex items-center justify-between px-6 border-b border-border/40">
                <span className="text-sm font-sans font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} />
                    Meeting Minutes
                    {isUpdating ? (
                        <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full ml-2 animate-pulse">
                            <RotateCw size={10} className="animate-spin" /> Updating...
                        </span>
                    ) : (
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full ml-2">
                            Saved
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-2">

                    <button
                        onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isAutoSyncEnabled
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                            }`}
                        title={isAutoSyncEnabled ? "Auto-sync with Chat is ON" : "Auto-sync with Chat is OFF"}
                    >
                        {isAutoSyncEnabled ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-neutral-400"></div>}
                        Auto-Update
                    </button>

                    <div className="w-px h-4 bg-border mx-1"></div>

                    <button onClick={() => onAskAI('structure', '')} className="btn-ghost p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded" title="Generate Structure"><FileText size={16} /></button>
                    <button onClick={() => onAskAI('write', 'abstract')} className="btn-ghost p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-purple-500" title="AI Write"><Wand2 size={16} /></button>
                    <button onClick={() => { /* download logic */ }} className="btn-ghost p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded" title="Download"><Download size={16} /></button>
                </div>
            </div>
            <textarea
                className="flex-1 w-full p-8 md:p-12 resize-none outline-none bg-transparent text-lg md:text-xl leading-loose font-serif placeholder:font-sans placeholder:text-muted-foreground/50 selection:bg-purple-100 dark:selection:bg-purple-900"
                placeholder="Meeting notes will appear here..."
                value={content}
                onChange={e => setContent(e.target.value)}
            />
        </div>
    );
}
