'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, X, Loader2, FileText, Image as ImageIcon, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TeamFile, subscribeToFileMessages, sendTeamFileMessage, subscribeToAiChatHistory, addAiChatMessage } from '@/lib/firestore';

interface FileChatPanelProps {
    file: TeamFile;
    teamId: string;
    userId: string;
    onClose: () => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    senderName?: string;
    id?: string;
    timestamp?: any;
}

export default function FileChatPanel({ file, teamId, userId, onClose }: FileChatPanelProps) {
    const [mode, setMode] = useState<'chat' | 'comment'>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [fileData, setFileData] = useState<{ data: string; mimeType: string } | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, mode]);

    // Firestore subscription for comments OR AI chat history
    useEffect(() => {
        if (!file.id || !teamId) return;

        if (mode === 'comment') {
            const unsubscribe = subscribeToFileMessages(teamId, file.id, (msgs) => {
                const formatted = msgs.map(m => ({
                    role: 'user' as const,
                    text: m.text,
                    senderName: m.senderName,
                    id: m.id,
                    timestamp: m.timestamp
                }));
                setMessages(formatted);
            });
            return () => unsubscribe();
        } else {
            // Subscribe to AI chat history (user-private)
            const unsubscribe = subscribeToAiChatHistory(userId, teamId, file.id, (msgs) => {
                const formatted = msgs.map(m => ({
                    role: m.role as 'user' | 'model',
                    text: m.text,
                    id: m.id
                }));
                setMessages(formatted);
            });
            return () => unsubscribe();
        }
    }, [mode, file.id, teamId, userId]);

    // Fetch file content for AI
    useEffect(() => {
        const fetchFileContent = async () => {
            if (!file.url || mode !== 'chat') return;
            try {
                const response = await fetch(`/api/proxy?url=${encodeURIComponent(file.url)}`);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    setFileData({
                        data: base64String,
                        mimeType: file.type || blob.type
                    });
                };
                reader.readAsDataURL(blob);
            } catch (error) {
                console.error("Error fetching file content:", error);
            }
        };
        fetchFileContent();
    }, [file.url, file.type, mode]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setIsLoading(true);

        if (mode === 'comment') {
            try {
                await sendTeamFileMessage(teamId, file.id, {
                    text: userMsg,
                    senderId: 'user', // We need actual user ID here?
                    senderName: 'Me' // And name
                });
                // Subscription handles update
            } catch (e) {
                console.error("Failed to send comment", e);
            } finally {
                setIsLoading(false);
            }
        } else {
            // AI Chat Mode - Save to Firestore for persistence (user-private)
            // Save user message first
            await addAiChatMessage(userId, teamId, file.id, { role: 'user', text: userMsg });

            try {
                let promptContext = `You are discussing the file "${file.name}".\n`;
                let requestBody: any = {
                    model: 'gemini-2.5-flash',
                    prompt: userMsg,
                    history: messages.map(m => ({
                        role: m.role,
                        parts: [{ text: m.text }]
                    })),
                    task: 'chat',
                    useGrounding: true
                };

                if (fileData) {
                    requestBody.fileData = fileData;
                    requestBody.systemInstruction = promptContext;
                } else {
                    requestBody.prompt = `${promptContext}\nUser Question: ${userMsg}`;
                }

                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!res.ok) throw new Error('Failed to fetch response');

                const data = await res.json();
                if (data.text) {
                    // Save AI response to Firestore (user-private)
                    await addAiChatMessage(userId, teamId, file.id, { role: 'model', text: data.text });
                } else if (data.error) {
                    throw new Error(data.error);
                } else {
                    throw new Error('Unexpected response format from AI');
                }
            } catch (error) {
                console.error("AI Error", error);
                // Save error message to Firestore so user knows what happened
                await addAiChatMessage(userId, teamId, file.id, { role: 'model', text: "Sorry, I encountered an error." });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-border w-80 md:w-96 shrink-0 animate-slide-in-right shadow-2xl z-50">
            {/* Header with Toggle */}
            <div className="p-3 border-b border-border flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('chat')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mode === 'chat' ? 'bg-white dark:bg-neutral-700 shadow-sm text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Bot size={14} />
                        AI Chat
                    </button>
                    <button
                        onClick={() => setMode('comment')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mode === 'comment' ? 'bg-white dark:bg-neutral-700 shadow-sm text-green-600' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <MessageSquare size={14} />
                        Comments
                    </button>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-muted-foreground">
                    <X size={16} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {mode === 'chat' && messages.length === 0 && (
                    <div className="text-center text-muted-foreground my-10 px-4">
                        <Bot size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Ask me anything about <strong>{file.name}</strong>!</p>
                        <div className="mt-4 space-y-2">
                            <button onClick={() => { setInput("Summarize this file"); handleSend(); }} className="block w-full text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors">"Summarize this file"</button>
                            <button
                                onClick={() => { setInput("What are the key points?"); handleSend(); }}
                                className="block w-full text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors"
                            >
                                "What are the key points?"
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'comment' && messages.length === 0 && (
                    <div className="text-center text-muted-foreground my-10">
                        <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No comments yet. Be the first!</p>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.senderName === 'Me' || m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'model' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {m.role === 'model' ? <Bot size={14} /> : <User size={14} />}
                        </div>
                        <div className={`max-w-[85%] text-sm p-3 rounded-2xl ${m.senderName === 'Me' || m.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-foreground rounded-tl-none'
                            }`}>
                            {mode === 'comment' && m.senderName && <div className="text-xs opacity-70 mb-1">{m.senderName}</div>}
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                    </div>
                ))}

                {isLoading && mode === 'chat' && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Bot size={14} /></div>
                        <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-muted-foreground" /> <span className="text-xs text-muted-foreground">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-neutral-50 dark:bg-neutral-800/30">
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-white dark:bg-neutral-900 border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder={mode === 'chat' ? "Ask AI..." : "Leave a comment..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || isLoading} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
