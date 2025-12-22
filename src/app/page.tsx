'use client';

import React, { useState, useEffect } from 'react';
import ChatInterface, { Message } from '@/components/ChatInterface';
import ArticleList from '@/components/ArticleList';
import PaperWriter from '@/components/PaperWriter';
import MindMap from '@/components/MindMap';
import SystemMapPanel from '@/components/SystemMapPanel';
import HistorySidebar from '@/components/HistorySidebar';
import { Moon, Sun, SidebarClose, SidebarOpen, Command, FileText, Map as MapIcon, X } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function Home() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Core State
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Features State
    const [articles, setArticles] = useState<any[]>([]);
    const [mindMapCode, setMindMapCode] = useState<any>(null);
    const [paperContent, setPaperContent] = useState('');

    // Sidebar State: 'none' | 'draft' | 'map'
    const [sidebarView, setSidebarView] = useState<'none' | 'draft' | 'map'>('none');

    useEffect(() => { setMounted(true); }, []);

    const handleSendMessage = async (text: string) => {
        const newMessages = [...messages, { role: 'user', content: text } as Message];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const isSearch = text.toLowerCase().startsWith('find') || text.toLowerCase().includes('search') || text.toLowerCase().includes('找');
            let systemContext = '';

            if (isSearch) {
                // Step 1: Ask Gemini for 3 keywords
                const keywordRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        task: 'summary',
                        prompt: `Identify the research topic from: "${text}". Return a JSON object with 3 distinct, specific English academic search keywords for Scopus. Format: {"keywords": ["term1", "term2", "term3"]}.`
                    })
                });
                const keywordData = await keywordRes.json();
                let keywords: string[] = [];
                try {
                    const parsed = JSON.parse(keywordData.text.replace(/```json/g, '').replace(/```/g, '').trim());
                    keywords = parsed.keywords || [];
                } catch (e) { console.error('Failed to parse keywords', e); }

                // Step 2: Search Scopus for each keyword (5 results each)
                let allResults: any[] = [];
                for (const keyword of keywords) {
                    try {
                        newMessages.push({ role: 'system', content: `Searching Scopus for: "${keyword}"...` });
                        // Update UI to show progress (optional, but good for UX)
                        setMessages([...newMessages]);

                        const scopusRes = await fetch(`/api/scopus?q=${encodeURIComponent(keyword)}&count=5`);
                        const scopusData = await scopusRes.json();

                        if (scopusData['search-results'] && scopusData['search-results']['entry']) {
                            allResults = [...allResults, ...scopusData['search-results']['entry']];
                        }
                    } catch (e) { console.error(`Search failed for ${keyword}`, e); }
                }

                // Deduplicate results by dc:identifier (Scopus ID) or doi
                const uniqueResults = Array.from(new Map(allResults.map(item => [item['dc:identifier'], item])).values());
                setArticles(uniqueResults);

                systemContext = `Found ${uniqueResults.length} articles based on keywords: ${keywords.join(', ')}. Articles: ${JSON.stringify(uniqueResults.map((r: any) => ({ title: r['dc:title'], abstract: r['dc:description']?.substring(0, 200) })))}`;
                newMessages.push({ role: 'system', content: `Found ${uniqueResults.length} articles total.` });
            }

            const history = newMessages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.content }] }));
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: 'chat', history: history, prompt: text + (systemContext ? `\n[System]: ${systemContext}` : '') })
            });
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', content: data.text }]);

            if (text.toLowerCase().includes('mind map') || text.toLowerCase().includes('概念圖') || text.toLowerCase().includes('心智圖')) {
                const mmRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        task: 'summary',
                        prompt: `Generate a Mind Map for: "${text}". Return ONLY valid JSON format for React Flow. 
                        Format: { 
                            "nodes": [
                                { "id": "1", "data": { "label": "Root Topic", "color": "#ffffff" }, "position": { "x": 250, "y": 0 }, "style": { "background": "transparent", "border": "none", "width": 150 } }
                            ], 
                            "edges": [] 
                        }. 
                        Create 5-10 nodes. Spread them out reasonably (x between 0-600, y between 0-600) so they don't overlap too much. Connect them logically.`
                    })
                });
                const mmData = await mmRes.json();
                try {
                    const code = mmData.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(code);

                    if (parsed.nodes && parsed.edges) {
                        setMindMapCode(JSON.stringify(parsed));
                        setSidebarView('map');
                    }
                } catch (e) { console.error("Failed to parse Mind Map JSON", e); }
            }
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    const handleAskAI = async (command: string, section: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                body: JSON.stringify({ task: 'summary', prompt: command === 'structure' ? `Generate concise academic paper structure (Markdown).` : `Write content for section '${section}'. \nPaper:\n${paperContent}` })
            });
            const data = await res.json();
            setPaperContent(prev => prev + '\n' + data.text);
        } catch (e) { } finally { setIsLoading(false); }
    };

    // History State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
    const [savedMaps, setSavedMaps] = useState<any[]>([]);
    const [savedChats, setSavedChats] = useState<any[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [currentMapId, setCurrentMapId] = useState<string | null>(null);
    const [currentChatsId, setCurrentChatsId] = useState<string | null>(null);
    const [activeNodeChats, setActiveNodeChats] = useState<any>(null);

    // Initial Load
    useEffect(() => {
        const drafts = localStorage.getItem('saved_drafts');
        if (drafts) setSavedDrafts(JSON.parse(drafts));

        const maps = localStorage.getItem('saved_maps');
        if (maps) setSavedMaps(JSON.parse(maps));

        const chats = localStorage.getItem('saved_chats');
        if (chats) setSavedChats(JSON.parse(chats));
    }, []);

    // AI Title Generation
    const generateAiTitle = async (content: string, type: 'Draft' | 'Mind Map' | 'Chat') => {
        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a very short, concise title (max 10 characters, Chinese or English) for this ${type}. \n\nContent:\n${content.substring(0, 500)}`,
                    systemInstruction: "You are a helpful assistant. Output ONLY the title, no quotes."
                })
            });
            const data = await response.json();
            return data.response.trim().substring(0, 15); // Safety clip
        } catch (e) {
            return null;
        }
    };

    // Rename Handler
    const handleRename = (type: 'draft' | 'map' | 'chat', id: string, newTitle: string) => {
        const updateList = (list: any[], setList: any, key: string) => {
            const updated = list.map(item =>
                item.id === id ? { ...item, title: newTitle } : item
            );
            setList(updated);
            localStorage.setItem(key, JSON.stringify(updated));
        };

        if (type === 'draft') updateList(savedDrafts, setSavedDrafts, 'saved_drafts');
        if (type === 'map') updateList(savedMaps, setSavedMaps, 'saved_maps');
        if (type === 'chat') updateList(savedChats, setSavedChats, 'saved_chats');
    };

    // New Draft Handler
    const handleNewDraft = () => {
        setCurrentDraftId(null);
        setPaperContent('');
        setSidebarView('draft');
    };

    // Auto-Save Draft
    useEffect(() => {
        if (!paperContent) return;

        const timer = setTimeout(async () => {
            const now = new Date();
            const newId = currentDraftId || now.getTime().toString();

            // Check if we need to generate a title (only for new drafts or untitled)
            let title = '';
            const existing = savedDrafts.find(d => d.id === newId);

            if (existing) {
                title = existing.title;
            } else {
                // New draft - try AI title
                const aiTitle = await generateAiTitle(paperContent, 'Draft');
                title = aiTitle || paperContent.split('\n')[0].substring(0, 10) || 'New Draft';
            }

            setSavedDrafts(prev => {
                const draftData = {
                    id: newId,
                    title,
                    content: paperContent,
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString() // Last edited
                };

                const others = prev.filter(d => d.id !== newId);
                const updated = [draftData, ...others];

                localStorage.setItem('saved_drafts', JSON.stringify(updated));
                if (!currentDraftId) setCurrentDraftId(newId);

                return updated;
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [paperContent, currentDraftId]);

    // Map Auto-Save Handler (called by SystemMapPanel)
    const handleAutoSaveMap = async (data: { nodes: any[], edges: any[] }) => {
        const now = new Date();
        const newId = currentMapId || now.getTime().toString();

        let title = '';
        const existing = savedMaps.find(m => m.id === newId);

        if (existing) {
            title = existing.title;
        } else {
            // New map - generate title from nodes
            const content = data.nodes.map(n => n.data.label).join(', ');
            const aiTitle = await generateAiTitle(content, 'Mind Map');
            title = aiTitle || `Map ${now.toLocaleDateString()}`;
        }

        setSavedMaps(prev => {
            const newMap = {
                id: newId,
                title,
                nodes: data.nodes,
                edges: data.edges,
                createdAt: existing?.createdAt || now.toISOString(),
                date: now.toISOString()
            };

            const others = prev.filter(m => m.id !== newId);
            const updated = [newMap, ...others];

            localStorage.setItem('saved_maps', JSON.stringify(updated));
            if (!currentMapId) setCurrentMapId(newId);

            return updated;
        });
    };

    // Chat Auto-Save Handler
    const handleAutoSaveChats = async (chats: any) => {
        const now = new Date();
        const newId = currentChatsId || now.getTime().toString();

        let title = '';
        const existing = savedChats.find(c => c.id === newId);

        if (existing) {
            title = existing.title;
        } else {
            // New chat - generic title or extract from first message
            const content = JSON.stringify(chats).substring(0, 200);
            const aiTitle = await generateAiTitle(content, 'Chat');
            title = aiTitle || `Chat ${now.toLocaleDateString()}`;
        }

        setSavedChats(prev => {
            const newChats = {
                id: newId,
                title,
                chats,
                createdAt: existing?.createdAt || now.toISOString(),
                date: now.toISOString()
            };

            const others = prev.filter(c => c.id !== newId);
            const updated = [newChats, ...others];

            localStorage.setItem('saved_chats', JSON.stringify(updated));
            if (!currentChatsId) setCurrentChatsId(newId);

            return updated;
        });
    };

    const onLoadDraft = (id: string) => {
        const draft = savedDrafts.find(d => d.id === id);
        if (draft) {
            setPaperContent(draft.content);
            setCurrentDraftId(draft.id);
            setSidebarView('draft');
            setHistoryOpen(false);
        }
    };

    const onLoadMap = (id: string) => {
        const map = savedMaps.find(m => m.id === id);
        if (map) {
            setMindMapCode(JSON.stringify({ nodes: map.nodes, edges: map.edges }));
            setCurrentMapId(map.id);
            setSidebarView('map');
            setHistoryOpen(false);
        }
    };

    const onLoadChats = (id: string) => {
        const history = savedChats.find(c => c.id === id);
        if (history) {
            setActiveNodeChats(history.chats);
            setCurrentChatsId(history.id);
            setSidebarView('map');
            setHistoryOpen(false);
        }
    };

    const onDeleteDraft = (id: string) => {
        const updated = savedDrafts.filter(d => d.id !== id);
        setSavedDrafts(updated);
        localStorage.setItem('saved_drafts', JSON.stringify(updated));
        if (currentDraftId === id) {
            setCurrentDraftId(null);
            setPaperContent('');
        }
    };

    const onDeleteChats = (id: string) => {
        const updated = savedChats.filter(c => c.id !== id);
        setSavedChats(updated);
        localStorage.setItem('saved_chats', JSON.stringify(updated));
        if (currentChatsId === id) {
            setCurrentChatsId(null);
            setActiveNodeChats(null);
        }
    };

    const onDeleteMap = (id: string) => {
        const updated = savedMaps.filter(m => m.id !== id);
        setSavedMaps(updated);
        localStorage.setItem('saved_maps', JSON.stringify(updated));
        if (currentMapId === id) {
            setCurrentMapId(null);
            setMindMapCode(null);
        }
    };


    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 relative">

            {/* History Sidebar */}
            <HistorySidebar
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                savedDrafts={savedDrafts}
                savedMaps={savedMaps}
                savedChats={savedChats}
                onLoadDraft={onLoadDraft}
                onLoadMap={onLoadMap}
                onLoadChats={onLoadChats}
                onDeleteDraft={onDeleteDraft}
                onDeleteMap={onDeleteMap}
                onDeleteChats={onDeleteChats}
                onRename={handleRename}
                onNewDraft={handleNewDraft}
            />

            {/* Toggle History Button */}
            <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`fixed top-1/2 right-0 transform -translate-y-1/2 z-[55] bg-white dark:bg-neutral-800 border border-border/50 p-2 rounded-l-xl shadow-lg transition-transform duration-300 ${historyOpen ? 'translate-x-full' : 'translate-x-0'}`}
            >
                <div className="writing-vertical-lr text-xs font-medium tracking-widest uppercase text-muted-foreground py-2 flex items-center gap-2">
                    <span className="rotate-180">History</span>
                </div>
            </button>


            {/* Search / Chat Area */}
            <div className={`flex-1 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${sidebarView !== 'none' ? 'mr-[40%]' : ''} relative z-10`} onClick={() => sidebarView !== 'none' && setSidebarView(sidebarView)}>

                {/* Minimal Header with Glass Effect */}
                <header className="absolute top-0 left-0 right-0 h-20 px-8 flex justify-between items-center z-20 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all duration-300">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center text-background shadow-sm">
                            <Command size={14} />
                        </div>
                        <span className="font-medium tracking-tight">Scopus Explorer</span>
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full border border-black/5 dark:border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'draft' ? 'none' : 'draft'); }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'draft' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <FileText size={14} /> Draft
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'map' ? 'none' : 'map'); }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'map' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <MapIcon size={14} /> Map
                        </button>
                    </div>
                </header>

                {/* Dynamic Content */}
                <main className="flex-1 flex flex-col overflow-y-auto w-full max-w-3xl mx-auto pt-24 px-6 pb-0 scrollbar-hide">
                    {/* Dynamic Greeting */}
                    {messages.length === 0 && (
                        <div className="min-h-[40vh] flex flex-col justify-end pb-8 animate-fade-in">
                            <h1 className="text-5xl md:text-6xl font-serif font-light tracking-tight mb-4 leading-[1.1]">
                                What shall we <br />
                                <span className="italic text-muted-foreground">research today?</span>
                            </h1>
                            <p className="text-lg text-muted-foreground font-light max-w-lg">
                                Powered by Gemini 2.0 & Scopus. Ask anything about academic papers.
                            </p>
                        </div>
                    )}

                    <ChatInterface
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        articles={articles}
                        onAddToContext={(doc) => setMessages(prev => [...prev, { role: 'system', content: `Added: ${doc['dc:title']} to context.` }])}
                    />
                </main>

                {/* Theme Toggle Floating Bottom Left */}
                {mounted && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
                        className="absolute bottom-6 left-6 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/20 transition-all z-20"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                )}
            </div>

            {/* Sidebar Container */}
            <div
                className={`fixed inset-y-0 right-0 w-[40%] bg-background border-l border-border/50 shadow-2xl z-30 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] glass-panel ${sidebarView !== 'none' ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {sidebarView === 'draft' && (
                    <PaperWriter
                        content={paperContent}
                        onChange={setPaperContent}
                        onAskAI={handleAskAI}
                    />
                )}

                {sidebarView === 'map' && (
                    <SystemMapPanel
                        mindMapData={typeof mindMapCode === 'string' ? JSON.parse(mindMapCode) : mindMapCode}
                        onSave={handleAutoSaveMap}
                        initialNodeChats={activeNodeChats}
                        onSaveChats={handleAutoSaveChats}
                    />
                )}

                {/* Close Button specifically for mobile or convenience */}
                {sidebarView !== 'none' && (
                    <button
                        onClick={() => setSidebarView('none')}
                        className="absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground z-50 md:hidden"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}
