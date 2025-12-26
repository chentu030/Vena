import React, { useState, useEffect } from 'react';
import { Search, X, Check, MessageSquare, Play } from 'lucide-react';

interface SearchConfig {
    keywords: string;
    scopusCount: number;
    geminiCount: number;
    originalMessage: string;
}

interface SearchConfirmationModalProps {
    isOpen: boolean;
    config: SearchConfig | null;
    onConfirm: (config: SearchConfig) => void;
    onCancel: () => void;
    onIgnore: () => void;
}

export default function SearchConfirmationModal({ isOpen, config, onConfirm, onCancel, onIgnore }: SearchConfirmationModalProps) {
    const [localConfig, setLocalConfig] = useState<SearchConfig | null>(null);

    useEffect(() => {
        if (config) {
            setLocalConfig(config);
        }
    }, [config]);

    if (!isOpen || !localConfig) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-blue-500/20 w-full max-w-md p-6 transform transition-all scale-100 opacity-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                        <Search size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Literature Search Detected</h3>
                        <p className="text-sm text-muted-foreground">The AI thinks you want to find papers.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Target Keywords</label>
                        <input
                            type="text"
                            value={localConfig.keywords}
                            onChange={(e) => setLocalConfig({ ...localConfig, keywords: e.target.value })}
                            className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-transparent focus:border-blue-500 outline-none transition-all font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Scopus Papers</label>
                            <input
                                type="number"
                                min="0"
                                max="50"
                                value={localConfig.scopusCount}
                                onChange={(e) => setLocalConfig({ ...localConfig, scopusCount: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-transparent focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Gemini Papers</label>
                            <input
                                type="number"
                                min="0"
                                max="50"
                                value={localConfig.geminiCount}
                                onChange={(e) => setLocalConfig({ ...localConfig, geminiCount: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-transparent focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-xs text-blue-600 dark:text-blue-400 mt-2">
                        <span className="font-bold">Original Request:</span> "{localConfig.originalMessage}"
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-8">
                    <button
                        onClick={() => onConfirm(localConfig)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Play size={16} fill="currentColor" /> Start Research
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={onIgnore}
                            className="w-full py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <MessageSquare size={16} /> Chat Only
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full py-2.5 border border-transparent hover:bg-red-50 dark:hover:bg-red-900/10 text-neutral-500 hover:text-red-600 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
