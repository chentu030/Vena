import React, { useState } from 'react';
import { Search, MessageSquare, X, ArrowRight } from 'lucide-react';

interface SearchConfig {
    keywords: string;
    scopusCount: number;
    geminiCount: number;
    originalMessage: string;
}

interface SearchConfirmationMessageProps {
    config: SearchConfig;
    onConfirm: (config: SearchConfig) => void;
    onCancel: (config: SearchConfig, chatOnly?: boolean) => void;
}

const SearchConfirmationMessage: React.FC<SearchConfirmationMessageProps> = ({ config, onConfirm, onCancel }) => {
    const [keywords, setKeywords] = useState(config.keywords);
    const [scopusCount, setScopusCount] = useState(config.scopusCount);
    const [geminiCount, setGeminiCount] = useState(config.geminiCount);
    const [startYear, setStartYear] = useState(2023);
    const [endYear, setEndYear] = useState(2026);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const handleConfirm = () => {
        setIsConfirmed(true);
        onConfirm({
            ...config,
            keywords,
            scopusCount,
            geminiCount,
            dateRange: { start: startYear, end: endYear }
        } as any);
    };

    if (isConfirmed) {
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <Search size={16} className="text-white" />
                </div>
                <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">Search Started</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Searching for "{keywords}"...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="bg-blue-50 dark:bg-blue-900/10 px-4 py-3 border-b border-border flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Search size={16} />
                </div>
                <div>
                    <h3 className="font-semibold text-sm text-foreground">Literature Search Detected</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">The AI thinks you want to find papers.</p>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {/* Keywords Input */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Target Keywords</label>
                    <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                </div>

                {/* Counts Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">Scopus Papers</label>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={scopusCount}
                            onChange={(e) => setScopusCount(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">Gemini Papers</label>
                        <input
                            type="number"
                            min={0}
                            max={50}
                            value={geminiCount}
                            onChange={(e) => setGeminiCount(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Date Range Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">Start Year</label>
                        <input
                            type="number"
                            min={1900}
                            max={2030}
                            value={startYear}
                            onChange={(e) => setStartYear(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">End Year</label>
                        <input
                            type="number"
                            min={1900}
                            max={2030}
                            value={endYear}
                            onChange={(e) => setEndYear(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Original Request Preview */}
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-xs text-muted-foreground border border-border/50">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Original Request:</span> "{config.originalMessage}"
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Search size={16} /> Start Research
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onCancel(config, true)}
                            className="py-2 bg-white dark:bg-neutral-800 border border-border hover:bg-neutral-50 dark:hover:bg-neutral-700 text-foreground rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={16} /> Chat Only
                        </button>
                        <button
                            onClick={() => onCancel(config, false)}
                            className="py-2 bg-white dark:bg-neutral-800 border border-border hover:bg-neutral-50 dark:hover:bg-neutral-700 text-muted-foreground hover:text-red-500 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchConfirmationMessage;
