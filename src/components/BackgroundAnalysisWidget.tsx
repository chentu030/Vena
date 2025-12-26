'use client';

import React from 'react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BackgroundAnalysisWidget() {
    const { state, cancelAnalysis, toggleWidget, closeWidget, isWidgetValues } = useAnalysis();
    const { isAnalyzing, progress, currentArticleTitle } = state;
    const { isOpen } = isWidgetValues;

    if (!isAnalyzing && !progress.message.includes('Complete')) return null;

    // Auto-hide when complete after a few seconds is handled by parent, 
    // but if it sticks around, we show "Analysis Complete".

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end"
            >
                <div className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'w-80' : 'w-auto'}`}>

                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-900 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        onClick={toggleWidget}
                    >
                        <div className="flex items-center gap-2">
                            {isAnalyzing ? (
                                <Loader2 className="animate-spin text-blue-500" size={16} />
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white">✓</div>
                            )}
                            <span className="text-sm font-medium">
                                {isAnalyzing
                                    ? (progress.message.includes('PDF') ? 'Finding PDFs' : 'Deep Analysis')
                                    : 'Analysis Done'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {!isAnalyzing && (
                                <div
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); closeWidget(); }}
                                    className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-muted-foreground transition-colors mr-1"
                                    title="Close"
                                >
                                    <X size={14} />
                                </div>
                            )}
                            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </div>
                    </div>

                    {/* Body (Collapsible) */}
                    {isOpen && (
                        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">

                            {/* Progress info */}
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>{progress.message.split('Analyzing')[0] || 'Processing...'}</span>
                                <span>{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden mb-3">
                                <motion.div
                                    className="h-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>

                            {/* Current Action */}
                            <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate mb-4">
                                {currentArticleTitle ? (
                                    <span className="italic">"{currentArticleTitle.substring(0, 40)}..."</span>
                                ) : (
                                    "Initializing..."
                                )}
                            </div>

                            {/* Actions */}
                            {isAnalyzing && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); cancelAnalysis(); }}
                                    className="w-full py-1.5 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                    Stop Analysis
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
