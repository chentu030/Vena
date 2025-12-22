import React, { useRef, useEffect } from 'react';
import { Send, User, Sparkles, ArrowUp } from 'lucide-react';

import ArticleList from './ArticleList';

import Link from 'next/link';

export interface Message {
    role: string;
    content: string;
}

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (msg: string) => void;
    isLoading: boolean;
    articles?: any[];
    onAddToContext?: (article: any) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, articles, onAddToContext }) => {
    const [input, setInput] = React.useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, articles]);

    return (

        <div className="flex flex-col flex-1 w-full min-h-[70vh] items-center">
            <div className="flex-1 w-full max-w-3xl px-6 md:px-8 pt-10 space-y-8 pb-32">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-6 animate-fade-in ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role !== 'user' && msg.role !== 'system' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-200 to-white dark:from-neutral-800 dark:to-neutral-900 border border-white/50 flex items-center justify-center shadow-sm shrink-0">
                                <Sparkles size={14} className="text-black dark:text-white" />
                            </div>
                        )}

                        <div className={`relative max-w-[85%] text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-neutral-100 dark:bg-neutral-800 px-5 py-3 rounded-2xl rounded-tr-sm text-foreground' : 'text-foreground'}`}>
                            {msg.role === 'system' ? (
                                <span className="text-xs uppercase tracking-wider text-muted-foreground border border-border px-3 py-1 rounded-full">{msg.content}</span>
                            ) : (
                                <div className="whitespace-pre-wrap font-light">{msg.content}</div>
                            )}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center shadow-sm shrink-0">
                                <User size={14} className="text-white dark:text-black" />
                            </div>
                        )}
                    </div>
                ))}

                {articles && articles.length > 0 && (
                    <div className="ml-14 animate-fade-in">
                        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-widest font-medium">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            Search Results
                        </div>
                        <ArticleList articles={articles} onAddToContext={onAddToContext!} />
                    </div>
                )}

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
                onSubmit={(e) => { e.preventDefault(); if (input.trim()) { onSendMessage(input); setInput(''); } }}
                className="sticky bottom-6 z-30 mx-auto w-full max-w-3xl px-6 md:px-8 mt-auto"
            >
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-2xl shadow-black/5 p-2 flex items-center transition-all focus-within:ring-2 ring-black/5 dark:ring-white/5">
                        <input
                            className="flex-1 bg-transparent border-none outline-none px-6 text-foreground placeholder-muted-foreground font-light text-base"
                            placeholder="Search Scopus or ask AI..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            disabled={!input.trim() || isLoading}
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
