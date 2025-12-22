import React from 'react';
import { Wand2, Download, FileText } from 'lucide-react';

export default function PaperWriter({ content, setContent, onAskAI }: any) {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-950 font-serif">
            <div className="h-14 flex items-center justify-between px-6 border-b border-border/40">
                <span className="text-sm font-sans font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    Draft <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded ml-2">Auto-save</span>
                </span>
                <div className="flex gap-2">
                    <button onClick={() => onAskAI('structure', '')} className="btn-ghost" title="Generate Structure"><FileText size={16} /></button>
                    <button onClick={() => onAskAI('write', 'abstract')} className="btn-ghost text-purple-500" title="AI Write"><Wand2 size={16} /></button>
                    <button onClick={() => { /* download logic */ }} className="btn-ghost" title="Download"><Download size={16} /></button>
                </div>
            </div>
            <textarea
                className="flex-1 w-full p-8 md:p-12 resize-none outline-none bg-transparent text-lg md:text-xl leading-loose font-serif placeholder:font-sans placeholder:text-muted-foreground/50 selection:bg-purple-100 dark:selection:bg-purple-900"
                placeholder="Start writing..."
                value={content}
                onChange={e => setContent(e.target.value)}
            />
        </div>
    );
}
