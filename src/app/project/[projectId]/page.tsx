'use client';

// This is the new home for the core workspace logic, identical to the original page.tsx
// but wrapped to use the projectId from the URL.

import React, { useState, useEffect, useRef } from 'react';
import ChatInterface, { Message } from '@/components/ChatInterface';
import ArticleList from '@/components/ArticleList';
import PaperWriter from '@/components/PaperWriter';
import MindMap from '@/components/MindMap';
import SystemMapPanel from '@/components/SystemMapPanel';
import HistorySidebar from '@/components/HistorySidebar';
import MainEditor from '@/components/MainEditor';
import ResearchPanel, { ResearchGroup, ResearchArticle } from '@/components/ResearchPanel';
import { PaperProvider } from '@/context/PaperContext';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Loader2, Moon, Sun, SidebarClose, SidebarOpen, Command, FileText, Map as MapIcon, X, BookOpen, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { saveDocument, loadCollection, deleteDocument, CollectionName, saveProjectData, loadProjectData, getProjectDetails, ProjectData } from '@/lib/firestore';
import { getIconComponent, getColorClasses } from '@/lib/project-utils';
import { useLanguage } from '@/context/LanguageContext';

interface SearchConfig {
    keywords: string;
    scopusCount: number;
    geminiCount: number;
    queries?: string[];
    originalMessage: string;
    dateRange?: { start: number; end: number };
    languages?: string[];  // 選擇的搜索語言
    targetGroupId?: string; // 目標群組 ID
    newGroupName?: string; // 如果創建新群組
}

export default function ProjectWorkspace() {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params?.projectId as string;
    const ownerId = searchParams.get('ownerId'); // If present, we are viewing another user's project
    const targetUserId = ownerId || user?.uid; // The ID of the data owner



    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    const [projectDetails, setProjectDetails] = useState<ProjectData | null>(null);

    // New Logic: Check ownership and permission
    const isOwner = ownerId ? ownerId === user?.uid : true;
    const isReadOnly = !isOwner && !projectDetails?.allowPublicEditing;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    const [mounted, setMounted] = useState(false);

    // Core State
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>('');

    // History / Saved Items
    const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
    const [savedMaps, setSavedMaps] = useState<any[]>([]);
    const [savedChats, setSavedChats] = useState<any[]>([]);
    const [savedManuscripts, setSavedManuscripts] = useState<any[]>([]);
    const [savedResearch, setSavedResearch] = useState<any[]>([]);

    // Current Active IDs
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [currentMapId, setCurrentMapId] = useState<string | null>(null);
    const [currentChatsId, setCurrentChatsId] = useState<string | null>(null);
    const [currentManuscriptId, setCurrentManuscriptId] = useState<string | null>(null);
    const [currentResearchId, setCurrentResearchId] = useState<string | null>(null);
    const [currentResearchResults, setCurrentResearchResults] = useState<any[]>([]);

    // Intent Detection State
    const [isCheckingIntent, setIsCheckingIntent] = useState(false);

    // Research Groups
    const [researchGroups, setResearchGroups] = useState<any[]>([]);
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
    const [latestSearchResults, setLatestSearchResults] = useState<any[]>([]); // New state for ephemeral search results

    // Features State
    const [articles, setArticles] = useState<any[]>([]);
    const [mindMapCode, setMindMapCode] = useState<any>(null);
    const [paperContent, setPaperContent] = useState('');
    const [mainContent, setMainContent] = useState('');
    const [activeNodeChats, setActiveNodeChats] = useState<any>(null); // For mind map node chats
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyButtonY, setHistoryButtonY] = useState(50); // Position in % from top

    // Sidebar State: 'none' | 'draft' | 'map' | 'main' | 'research'
    const [sidebarView, setSidebarView] = useState<'none' | 'draft' | 'map' | 'main' | 'research'>('none');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

    // Resizable sidebar width (percentage)
    const [sidebarWidth, setSidebarWidth] = useState(45);
    const [isResizing, setIsResizing] = useState(false);

    // Abort Controller for stopping generation
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setLoadingStatus('');
    };

    useEffect(() => { setMounted(true); }, []);

    // Initial Load - From Firestore (Scoped to Project)
    useEffect(() => {
        const loadAll = async () => {
            if (!targetUserId || !projectId) return;
            try {
                // Load Project Meta
                const details = await getProjectDetails(targetUserId, projectId);
                setProjectDetails(details);

                const [drafts, maps, chats, manuscripts, research, groups] = await Promise.all([
                    loadCollection(targetUserId, 'drafts', projectId),
                    loadCollection(targetUserId, 'maps', projectId),
                    loadCollection(targetUserId, 'chats', projectId),
                    loadCollection(targetUserId, 'manuscripts', projectId),
                    loadCollection(targetUserId, 'research', projectId),
                    loadCollection(targetUserId, 'researchGroups', projectId)
                ]);
                setSavedDrafts(drafts);
                setSavedMaps(maps);
                setSavedChats(chats);
                setSavedManuscripts(manuscripts);
                setSavedResearch(research);
                setResearchGroups(groups);

                // Auto-select first group if exists
                if (groups.length > 0) {
                    setCurrentGroupId(groups[0].id);
                    setCurrentResearchResults((groups[0] as any).papers || []);
                }

                // Load current project data (single Map and Chat) - Scoped to Project
                const [currentMap, currentChat] = await Promise.all([
                    loadProjectData(targetUserId, 'currentMap', projectId),
                    loadProjectData(targetUserId, 'currentChat', projectId)
                ]);
                if (currentMap && currentMap.data) {
                    setMindMapCode(currentMap.data);
                }
                if (currentChat && currentChat.messages) {
                    setMessages(currentChat.messages);
                } else {
                    // Smart Create Logic: Check for pre-parsed config or topic
                    const initialConfigStr = searchParams.get('initialSearchConfig');
                    const initialTopic = searchParams.get('initialSearchTopic');

                    if (initialConfigStr) {
                        // New flow: Config already parsed by Dashboard/Home
                        handleParsedSearchConfig(initialConfigStr);
                    } else if (initialTopic) {
                        // Legacy flow: Just topic, needs analysis
                        handleInitialTopicAnalysis(initialTopic);
                    }
                }

                // Restore last active Manuscript
                if (manuscripts.length > 0) {
                    // Sort by updatedAt desc to get the latest
                    const sorted = [...manuscripts].sort((a: any, b: any) =>
                        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
                    ) as any[];

                    const latest = sorted[0];
                    if (latest) {
                        setCurrentManuscriptId(latest.id);
                        setMainContent(latest.content || '');
                        console.log("Restored latest manuscript:", latest.title);
                    }
                }
            } catch (e) {
                console.error("Failed to load history", e);
            }
        };
        if (user && projectId) {
            console.log("Loading all data for:", { targetUserId, projectId, isOwner, isReadOnly });
            loadAll();
        }
    }, [user, projectId]);

    // New: Handle pre-parsed search config from URL
    const handleParsedSearchConfig = (configStr: string) => {
        try {
            const config = JSON.parse(configStr);

            // Add a welcoming system message
            const welcomeMsg: Message = {
                role: 'system',
                content: `👋 ${t('project.intent.welcome')}`
            };
            setMessages([welcomeMsg]);

            // Build the full config for the confirmation dialog
            const fullConfig = {
                keywords: config.keywords || '',
                languages: config.languages || ['en'],
                scopusCount: config.scopusCount || 15,
                geminiCount: config.geminiCount || 15,
                dateRange: {
                    start: config.startYear || 2020,
                    end: config.endYear || 2025
                },
                additionalInstructions: config.additionalInstructions || '',
                originalMessage: config.originalMessage || config.keywords
            };

            // Add the confirmation message with pre-filled config
            setMessages(prev => [...prev, {
                role: 'model',
                type: 'search-confirmation',
                content: JSON.stringify(fullConfig)
            }]);

        } catch (e) {
            console.error("Failed to parse initialSearchConfig", e);
        }
    };

    const handleInitialTopicAnalysis = async (topic: string) => {
        // Prevent double execution if messages already exist (handled in logic above)
        setLoadingStatus("Analyzing research topic...");

        // Add a welcoming system message
        const welcomeMsg: Message = {
            role: 'system',
            content: `👋 ${t('project.intent.analyzing')}`
        };
        setMessages([welcomeMsg]);

        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    task: 'summary',
                    prompt: `Analyze the research topic: "${topic}" and extract search configuration.
                    
                    Return JSON ONLY with this structure:
                    {
                        "keywords": "main academic search string (with OR/AND if needed)",
                        "languages": ["en", "zh-TW"], // Detect derived languages
                        "scopusCount": 15,
                        "geminiCount": 15,
                        "startYear": 2020,
                        "endYear": 2025
                    }
                    
                    Rules:
                    - Defaults: languages=['en'], counts=15.
                    - If topic contains Chinese characters, include 'zh-TW' and 'zh-CN' in languages.
                    - If topic mentions "法文" or "French", include 'fr'.
                    - If topic mentions years like "2020-2023", set startYear=2020, endYear=2023.
                    `
                })
            });

            const data = await res.json();
            let config = {
                keywords: topic,
                languages: ['en'],
                scopusCount: 15,
                geminiCount: 15,
                dateRange: { start: 2020, end: 2025 },
                originalMessage: topic
            };

            if (data.text) {
                const jsonStr = data.text.replace(/^["']|["']$/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
                try {
                    const parsed = JSON.parse(jsonStr);
                    config = {
                        ...config,
                        ...parsed,
                        dateRange: { start: parsed.startYear || 2020, end: parsed.endYear || 2025 },
                        originalMessage: topic
                    };
                } catch (e) {
                    console.error("Failed to parse config JSON", e);
                }
            }

            // Add the confirmation message
            setMessages(prev => [...prev, {
                role: 'model',
                type: 'search-confirmation',
                content: JSON.stringify(config)
            }]);

        } catch (error) {
            console.error("Initial analysis failed", error);
            // Fallback
            setMessages(prev => [...prev, {
                role: 'model',
                type: 'search-confirmation',
                content: JSON.stringify({
                    keywords: topic,
                    scopusCount: 15,
                    geminiCount: 15,
                    originalMessage: topic,
                    languages: ['en'],
                    dateRange: { start: 2020, end: 2025 }
                })
            }]);
        } finally {
            setLoadingStatus("");
        }
    };

    // Auto-save Main Content (Manuscript)
    const lastSaveRef = useRef<number>(Date.now());
    const isFirstLoadRef = useRef(true);
    const savedManuscriptsRef = useRef(savedManuscripts);

    // Sync ref
    useEffect(() => {
        savedManuscriptsRef.current = savedManuscripts;
    }, [savedManuscripts]);

    useEffect(() => {
        if (!user || !projectId || !mainContent) return;

        // Skip save on initial mount/content load to prevent overwrites or empty saves
        if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            // If we have content, syncing the ref time is good
            return;
        }

        const performSave = async () => {
            const docId = currentManuscriptId || `manuscript_${Date.now()}`;
            const title = currentManuscriptId
                ? savedManuscripts.find(m => m.id === currentManuscriptId)?.title
                : `Literature Review ${new Date().toLocaleDateString()}`;

            if (!currentManuscriptId) setCurrentManuscriptId(docId);

            try {
                await saveDocument(user.uid, 'manuscripts', {
                    id: docId,
                    title: title || 'Untitled Manuscript',
                    content: mainContent,
                    updatedAt: new Date().toISOString()
                }, projectId);
                console.log("Manuscript auto-saved (60s/10s rule)");
                lastSaveRef.current = Date.now();
            } catch (e) {
                console.error("Auto-save failed", e);
            }
        };

        const now = Date.now();
        // Rule 1: Continuous usage -> Save every 60s
        if (now - lastSaveRef.current > 60000) {
            performSave();
            return; // Executed immediate save, no need for debounce
        }

        // Rule 2: Idle -> Save after 10s of no changes
        const timer = setTimeout(performSave, 10000);

        return () => clearTimeout(timer); // Reset timer on typing
        return () => clearTimeout(timer); // Reset timer on typing
    }, [mainContent, user, currentManuscriptId, savedManuscripts, projectId]);

    // NEW: Extracted Logic for Literature Search Execution
    const executeLiteratureSearch = async (config: SearchConfig) => {
        setIsLoading(true);

        setSidebarView('research'); // Switch to research tab

        // 處理群組選擇
        if (config.newGroupName && user && projectId) {
            // 創建新群組
            const newGroup = {
                id: `group-${Date.now()}`,
                name: config.newGroupName,
                papers: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setResearchGroups(prev => [newGroup, ...prev]);
            setCurrentGroupId(newGroup.id);
            setCurrentResearchResults([]);
            saveDocument(user.uid, 'researchGroups', newGroup, projectId);
        } else if (config.targetGroupId && config.targetGroupId !== currentGroupId) {
            // 切換到選擇的群組
            setCurrentGroupId(config.targetGroupId);
            const group = researchGroups.find(g => g.id === config.targetGroupId);
            setCurrentResearchResults(group?.papers || []);
        }

        // 語言配置映射
        const LANGUAGE_MAP: Record<string, { name: string; translateName: string }> = {
            'en': { name: 'English', translateName: 'English' },
            'zh-TW': { name: '繁體中文', translateName: 'Traditional Chinese' },
            'zh-CN': { name: '简体中文', translateName: 'Simplified Chinese' },
            'ja': { name: '日本語', translateName: 'Japanese' },
            'ko': { name: '한국어', translateName: 'Korean' },
            'de': { name: 'German', translateName: 'German' },
            'fr': { name: 'French', translateName: 'French' },
            'es': { name: 'Spanish', translateName: 'Spanish' },
            'pt': { name: 'Portuguese', translateName: 'Portuguese' },
            'ru': { name: 'Russian', translateName: 'Russian' },
        };

        const selectedLanguages = config.languages || ['en'];
        const languageNames = selectedLanguages.map(id => LANGUAGE_MAP[id]?.name || id).join(', ');

        // 顯示群組資訊
        const groupInfo = config.newGroupName
            ? ` → ${t('search.groupLabel')}: "${config.newGroupName}"`
            : config.targetGroupId
                ? ` → ${t('search.groupLabel')}: "${researchGroups.find(g => g.id === config.targetGroupId)?.name || t('research.batch.selected')}"`
                : '';

        const newMessages = [...messages, {
            role: 'system',
            content: t('search.status.starting', {
                keywords: config.keywords,
                languages: languageNames,
                scopusCount: config.scopusCount,
                geminiCount: config.geminiCount,
                groupInfo
            })
        }];
        setMessages(newMessages);

        // Start Abort Controller
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            // Helper: Generate PDF link
            const generatePdfLink = (title: string, doi: string) => {
                if (doi) return `https://doi.org/${doi}`;
                return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
            };

            // 翻譯關鍵詞函數
            const translateKeywords = async (keywords: string, targetLanguages: string[]): Promise<Record<string, string>> => {
                // 如果只有英文，直接返回
                if (targetLanguages.length === 1 && targetLanguages[0] === 'en') {
                    return { 'en': keywords };
                }

                setLoadingStatus(t('search.status.translating', { count: targetLanguages.length }));

                const translationPrompt = `Translate the following academic search keywords into multiple languages.
Keywords: "${keywords}"

Target languages: ${targetLanguages.map(id => LANGUAGE_MAP[id]?.translateName || id).join(', ')}

Return ONLY a valid JSON object in this format:
{
  ${targetLanguages.map(id => `"${id}": "translated keywords"`).join(',\n  ')}
}

Rules:
- Keep academic/technical terms in their appropriate form for each language
- For CJK languages (Chinese, Japanese, Korean), use native academic terminology
- Do NOT add explanations, just the JSON
- Make keywords search-friendly for academic databases`;

                try {
                    const res = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            model: 'gemini-2.0-flash',
                            task: 'summary',
                            prompt: translationPrompt,
                            history: []
                        }),
                        signal
                    });

                    const data = await res.json();
                    if (!data.text) {
                        console.warn('Translation failed, using original keywords');
                        return targetLanguages.reduce((acc, lang) => ({ ...acc, [lang]: keywords }), {});
                    }

                    let jsonStr = data.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) jsonStr = jsonMatch[0];

                    const translations = JSON.parse(jsonStr);
                    console.log('Translated keywords:', translations);
                    return translations;
                } catch (e) {
                    console.error('Translation error:', e);
                    return targetLanguages.reduce((acc, lang) => ({ ...acc, [lang]: keywords }), {});
                }
            };

            // Fetch from Scopus (with Offset)
            const fetchScopus = async (searchQuery: string, limit: number, offset: number = 0, langTag?: string) => {
                try {
                    // Extended Date Range: Up to 2026 to include future publications
                    const startYear = config.dateRange?.start || 2023;
                    const endYear = config.dateRange?.end || 2026;
                    const dateFilter = `PUBYEAR > ${startYear - 1} AND PUBYEAR < ${endYear + 1}`;
                    const fullQuery = `TITLE-ABS-KEY(${searchQuery}) AND ${dateFilter}`;
                    const res = await fetch(`/api/scopus?q=${encodeURIComponent(fullQuery)}&count=${limit}&start=${offset}`, { signal });
                    const data = await res.json();

                    if (data.error) return [];

                    return (data['search-results']?.entry || []).map((entry: any) => ({
                        id: entry['dc:identifier']?.split(':')[1] || Math.random().toString(),
                        title: entry['dc:title'],
                        authors: entry['dc:creator'] || 'Unknown',
                        source: entry['prism:publicationName'],
                        year: entry['prism:coverDate'] ? entry['prism:coverDate'].substring(0, 4) : 'N/A',
                        doi: entry['prism:doi'],
                        link: generatePdfLink(entry['dc:title'], entry['prism:doi']),
                        abstract: entry['dc:description'] || 'No abstract available.',
                        keywords: '',
                        sourceModel: 'scopus',
                        searchLanguage: langTag
                    }));
                } catch (e) {
                    console.error("Scopus fetch failed", e);
                    return [];
                }
            };

            // Fetch from Gemini (Extended Date)
            const fetchGemini = async (searchQuery: string, limit: number, langTag?: string, languageName?: string) => {
                try {
                    const startYear = config.dateRange?.start || 2023;
                    const endYear = config.dateRange?.end || 2026;
                    const languageInstruction = languageName && languageName !== 'English'
                        ? `\n- Focus on papers with titles/abstracts in ${languageName} or about ${languageName}-speaking regions when relevant.`
                        : '';
                    const userInstructions = (config as any).additionalInstructions
                        ? `\n- User's additional requirements: ${(config as any).additionalInstructions}`
                        : '';

                    const prompt = `You are a research assistant. Use Google Search to find ${limit} REAL, EXISTING, and VERIFIED academic papers (${startYear}-${endYear}) about: "${searchQuery}".
                
                IMPORTANT:
                - Use the "googleSearch" tool to verify the existence of each paper.
                - Do NOT hallucinate papers.${languageInstruction}${userInstructions}
                - Return JSON ONLY.

                Return JSON: {"articles":[{"authors":"...","title":"...","source":"...","year":"...","abstract":"...","doi":"..."}]}`;
                    const res = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            model: 'gemini-3-pro-preview',
                            task: 'summary',
                            prompt: prompt,
                            history: [],
                            useGrounding: true
                        }),
                        signal
                    });
                    const data = await res.json();
                    if (!data.text) return [];
                    let jsonStr = data.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                    const jsonMatch = jsonStr.match(/\{[\s\S]*"articles"[\s\S]*\}/);
                    if (jsonMatch) jsonStr = jsonMatch[0];

                    let parsed;
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch (e) {
                        return [];
                    }

                    return (parsed.articles || []).map((e: any, i: number) => ({
                        id: `gen-${Date.now()}-${i}`,
                        authors: e.authors || 'Unknown',
                        title: e.title,
                        source: e.source || 'Unknown',
                        year: e.year || 'N/A',
                        doi: e.doi || '',
                        link: generatePdfLink(e.title, e.doi),
                        abstract: e.abstract || '',
                        sourceModel: 'gemini-3-pro-preview',
                        searchLanguage: langTag
                    }));
                } catch (e) {
                    console.error("Gemini fetch failed", e);
                    return [];
                }
            };

            // Step 1: 翻譯關鍵詞到各選擇的語言
            const translatedKeywords = await translateKeywords(config.keywords, selectedLanguages);

            // Step 2: 對每種語言進行搜索
            const allScopusResults: any[] = [];
            const allGeminiResults: any[] = [];

            // Calculate papers per language
            const papersPerLanguage = Math.ceil(config.scopusCount / selectedLanguages.length);
            const geminiPapersPerLanguage = Math.ceil(config.geminiCount / selectedLanguages.length);

            // Calculate offset based on existing Scopus papers
            const existingScopusCount = currentResearchResults.filter(r => r.sourceModel === 'scopus').length;

            for (let i = 0; i < selectedLanguages.length; i++) {
                const langId = selectedLanguages[i];
                const langName = LANGUAGE_MAP[langId]?.name || langId;
                const translatedQuery = translatedKeywords[langId] || config.keywords;

                setLoadingStatus(`🔍 [${i + 1}/${selectedLanguages.length}] Searching in ${langName}: "${translatedQuery.substring(0, 30)}..."`);

                // Scopus 搜索
                const scopusPromise = fetchScopus(
                    translatedQuery,
                    papersPerLanguage,
                    existingScopusCount + (i * papersPerLanguage),
                    langId
                );

                // Gemini 搜索
                const geminiPromise = fetchGemini(
                    translatedQuery,
                    geminiPapersPerLanguage,
                    langId,
                    langName
                );

                const [scopusRes, geminiRes] = await Promise.all([scopusPromise, geminiPromise]);

                allScopusResults.push(...scopusRes);
                allGeminiResults.push(...geminiRes);
            }

            setLoadingStatus("Processing results...");

            const newPapers = [...allScopusResults, ...allGeminiResults];

            // Deduplication: Filter out papers already present in current results
            const existingKeys = new Set(currentResearchResults.map((p: any) => (p.doi || p.title || '').toLowerCase()));
            const uniquePapers = newPapers.filter(p => !existingKeys.has((p.doi || p.title || '').toLowerCase()));

            // Also deduplicate within new results (same paper might appear in multiple languages)
            const seenKeys = new Set<string>();
            const deduplicatedPapers = uniquePapers.filter(p => {
                const key = (p.doi || p.title || '').toLowerCase();
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
            });

            const mergedResults = [...currentResearchResults, ...deduplicatedPapers];
            setCurrentResearchResults(mergedResults);
            setLatestSearchResults(deduplicatedPapers); // Update ephemeral results with only NEW papers

            const skippedCount = newPapers.length - deduplicatedPapers.length;
            const statusMsg = deduplicatedPapers.length > 0
                ? `✅ Found ${deduplicatedPapers.length} NEW papers for "${config.keywords}" in ${languageNames}`
                : `⚠️ Search completed but found NO new unique papers (all ${skippedCount} items were duplicates).`;

            const extraMsg = skippedCount > 0 && deduplicatedPapers.length > 0 ? ` (${skippedCount} duplicates skipped)` : '';

            setMessages(prev => [...prev, {
                role: 'model',
                content: `${statusMsg}${extraMsg}. Check the Research Panel.`
            }]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', content: "❌ Search failed." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // NEW: Extracted Logic for Normal Chat Response
    const processChatResponse = async (text: string, fileContext: string = '', newMessages: Message[]) => {
        const systemContext = `You are Venalium, an advanced academic research assistant.
            Current Project: ${projectDetails?.name}
            Description: ${projectDetails?.description}
            
            User Query: "${text}"
            
            ${fileContext ? `Context from uploaded file:\n${fileContext}` : ''}
            
            Provide a helpful, professional, and academically rigorous response.`;

        try {
            // Check for non-text models first (e.g. if user selected image generation model, handled elsewhere? Assumed generic here)
            setLoadingStatus("Thinking...");
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-3-pro-preview', // Default to smarter model
                    task: 'chat',
                    prompt: text,
                    history: newMessages.slice(0, -1).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
                    systemInstruction: systemContext
                }),
                signal: abortControllerRef.current?.signal // Use abort signal
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'model', content: data.text }]);

        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log('Generation stopped by user');
                return;
            }
            console.error("Chat Error", e);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error responding." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (text: string, model: string = 'gemini-2.5-flash', fileContent?: string, fileName?: string, referencedGroups?: string[]) => {
        setLatestSearchResults([]); // Clear previous search results on new message
        // Build display message
        let displayText = text;
        if (fileName) {
            displayText = `📎 ${fileName}\n${text}`;
        }
        if (referencedGroups && referencedGroups.length > 0) {
            const groupNames = referencedGroups.map(gid => researchGroups.find(g => g.id === gid)?.name).filter(Boolean).join(', ');
            displayText = `[Ref Group: ${groupNames}] ${text}`;
        }

        const newMessages = [...messages, { role: 'user', content: displayText } as Message];
        setMessages(newMessages);
        setIsLoading(true);

        // Start Abort Controller
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // 0. Intent Detection (If NOT a specific command like "Draft Research Methods" or referencing groups)
        // If groups are referenced, we skip generic intent detection and go straight to group logic
        // If it's a specific "Research Methods" draft, we also skip
        const isSpecificCommand = referencedGroups && referencedGroups.length > 0;

        if (!isSpecificCommand && !text.includes('請為選定的資料庫建立心智圖') && !text.includes('mind map')) {
            setIsCheckingIntent(true);
            setLoadingStatus("Understanding request...");
            try {
                // Determine user intent with Gemini (Fast Model)
                const intentRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: 'gemini-3-flash-preview',
                        task: 'summary',
                        prompt: `Analyze the user's message and determine if they want to SEARCH for academic literature/papers.
                        User Message: "${text}"
                        
                        Return JSON ONLY:
                        {
                            "isSearch": boolean,
                            "keywords": "string",
                            "queries": ["string"],
                            "scopusCount": number,
                            "geminiCount": number
                        }
                        
                        Rules:
                        - isSearch: true ONLY if the user explicitly asks to find/search papers.
                        - keywords: Create a query based on the CORE TERM + Specific Extensions (Master Query).
                        - queries: If request > 15 papers, generate multiple distinct Boolean queries to run in batches. Vary the attributes (e.g. Q1: market, Q2: pricing).
                        - counts: suggest reasonable defaults (e.g. 15).
                        `
                    }),
                    signal
                });

                const intentData = await intentRes.json();
                const jsonStr = (intentData.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
                const intent = JSON.parse(jsonStr);

                if (intent.isSearch) {
                    const searchConfig: SearchConfig = {
                        keywords: intent.keywords || text,
                        queries: intent.queries,
                        scopusCount: intent.scopusCount || 15,
                        geminiCount: intent.geminiCount || 15,
                        originalMessage: text
                    };

                    // Add special confirmation message
                    setMessages(prev => [...prev, {
                        role: 'model',
                        content: JSON.stringify(searchConfig),
                        type: 'search-confirmation'
                    } as Message]);

                    setIsCheckingIntent(false);
                    setIsLoading(false); // Wait for user interaction
                    return;
                }
            } catch (e) {
                console.warn("Intent detection failed", e);
                // Fallback to normal flow
            } finally {
                setIsCheckingIntent(false);
            }
        }



        try {
            // Priority: Check for Group Reference + Request
            if (referencedGroups && referencedGroups.length > 0) {
                // 1. Gather all papers with index numbers
                const targetPapers = referencedGroups.flatMap(gid => {
                    const group = researchGroups.find(g => g.id === gid);
                    return group?.papers || [];
                });

                if (targetPapers.length === 0) {
                    setMessages(prev => [...prev, { role: 'model', content: t('research.group.no_papers') }]);
                    setIsLoading(false);
                    return;
                }

                // Check for Manuscript Generation Request (Full Proposal or Methods)
                if (text.includes("撰寫研究方法與理論架構文章") || text.includes("Draft Research Methods") || text.includes("Research Methods") || text.includes("撰寫研究計畫書") || text.includes("Draft Research Proposal")) {

                    const isFullProposal = text.includes("撰寫研究計畫書") || text.includes("Draft Research Proposal") || text.includes("撰寫研究方法與理論架構文章");
                    const statusText = isFullProposal ? t('manuscript.status.drafting_proposal') : t('manuscript.status.drafting_methods');

                    newMessages.push({ role: 'system', content: `📝 ${statusText} with Gemini 3.0 Pro...` });
                    setMessages([...newMessages]);

                    // Import dynamically or use what's available
                    const { RESEARCH_PROPOSAL_STRUCTURE, generateSectionPrompt, generateMermaidPrompt } = await import('@/lib/manuscriptPrompts');

                    // If it's just "Research Methods", we might want to just run the methodology section or the old prompt?
                    // User asked to "redesign prompts" based on the file. Let's strictly use the new multi-step approach for "Research Proposal".
                    // If it's the old strict "Methods" request, we can perhaps map it to the 'methodology' section of the new structure.

                    let sectionsToGenerate = RESEARCH_PROPOSAL_STRUCTURE;
                    if (!isFullProposal) {
                        // If only methods requested, just do methodology section
                        sectionsToGenerate = RESEARCH_PROPOSAL_STRUCTURE.filter(s => s.id === 'methodology');
                    }

                    // Loop through sections sequentially
                    let fullGeneratedContent = "";
                    let methodologyContent = ""; // Store methodology content for Mermaid generation

                    for (const section of sectionsToGenerate) {
                        setLoadingStatus(t('manuscript.status.drafting_section', { section: section.title }));

                        const prompt = generateSectionPrompt(section.id, projectDetails?.name || "Target Topic", targetPapers, section.sectionNumber);

                        // Retry logic for section generation
                        const MAX_RETRIES = 3;
                        let sectionContent = '';
                        let sectionSuccess = false;

                        for (let attempt = 1; attempt <= MAX_RETRIES && !sectionSuccess; attempt++) {
                            try {
                                if (attempt > 1) {
                                    setLoadingStatus(t('manuscript.status.retrying_section', { section: section.title, attempt, max: MAX_RETRIES }));
                                }

                                const res = await fetch('/api/gemini', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        model: 'gemini-3-pro-preview',
                                        task: 'summary',
                                        prompt: prompt,
                                        history: []
                                    })
                                });

                                if (!res.ok) throw new Error("Gemini API failed");

                                const data = await res.json();
                                sectionContent = data.text || '';

                                if (!sectionContent || sectionContent.length < 100) {
                                    throw new Error("Response too short or empty");
                                }

                                if (data.error) throw new Error(data.details || data.error);

                                sectionSuccess = true;
                            } catch (err) {
                                console.error(`Attempt ${attempt} failed for section ${section.id}:`, err);
                                if (attempt === MAX_RETRIES) {
                                    setMessages(prev => [...prev, { role: 'model', content: t('manuscript.error.section_failed', { section: section.title, retries: MAX_RETRIES }) }]);
                                }
                            }
                        }

                        if (!sectionSuccess) continue; // Skip to next section if all retries failed

                        // Normalize citations: [ID:1, 2] -> [1, 2]
                        sectionContent = sectionContent.replace(/\\\[ID:([\d\s,]+)\\\]/g, '[ID:$1]');
                        sectionContent = sectionContent.replace(/\[ID:([\d\s,]+)\]/g, '[$1]');
                        sectionContent = sectionContent.replace(/\[ID:\s*(\d+)\]/g, '[$1]');

                        // Store methodology content for Mermaid generation
                        if (section.id === 'methodology') {
                            methodologyContent = sectionContent;
                        }

                        // Append this section to the main content state progressively
                        const divider = (fullGeneratedContent || mainContent) ? "\n\n---\n\n" : "";
                        const newSectionBlock = `${divider}# ${section.title}\n\n${sectionContent}`;

                        // Update local variable
                        fullGeneratedContent += newSectionBlock;

                        // Update Editor State immediately so user sees progress
                        setMainContent(prev => (prev || '') + newSectionBlock);

                        // If this was the methodology section, generate a dedicated Mermaid diagram with retry
                        if (section.id === 'methodology' && methodologyContent) {
                            setLoadingStatus(t('manuscript.status.designing_diagram'));

                            let mermaidSuccess = false;

                            for (let mermaidAttempt = 1; mermaidAttempt <= MAX_RETRIES && !mermaidSuccess; mermaidAttempt++) {
                                try {
                                    if (mermaidAttempt > 1) {
                                        setLoadingStatus(t('manuscript.status.retrying_diagram', { attempt: mermaidAttempt, max: MAX_RETRIES }));
                                    }

                                    const mermaidPrompt = generateMermaidPrompt(projectDetails?.name || "Target Topic", methodologyContent);
                                    const mermaidRes = await fetch('/api/gemini', {
                                        method: 'POST',
                                        body: JSON.stringify({
                                            model: 'gemini-3-flash-preview',
                                            task: 'summary',
                                            prompt: mermaidPrompt,
                                            history: []
                                        })
                                    });

                                    if (!mermaidRes.ok) throw new Error("Mermaid API failed");

                                    const mermaidData = await mermaidRes.json();
                                    let mermaidCode = mermaidData.text || '';

                                    console.log(`Mermaid attempt ${mermaidAttempt}:`, mermaidCode);

                                    // Try to extract mermaid block
                                    const mermaidMatch = mermaidCode.match(/```mermaid[\s\S]*?```/);
                                    if (mermaidMatch) {
                                        mermaidCode = mermaidMatch[0];
                                    } else {
                                        // Fallback: wrap raw mermaid code
                                        const mermaidKeywords = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap)/m;
                                        if (mermaidKeywords.test(mermaidCode)) {
                                            mermaidCode = `\`\`\`mermaid\n${mermaidCode.trim()}\n\`\`\``;
                                        }
                                    }

                                    // Ensure newline after ```mermaid to prevent parsing issues
                                    // Sometimes AI generates ```mermaid graph TD without newline
                                    if (mermaidCode.includes('```mermaid')) {
                                        mermaidCode = mermaidCode.replace(/```mermaid\s*([a-z]+)/i, '```mermaid\n$1');
                                    }

                                    // Validate and add
                                    const isValidMermaid = mermaidCode.includes('```mermaid') && mermaidCode.length > 30;

                                    if (isValidMermaid) {
                                        const mermaidBlock = `\n\n### ${t('manuscript.diagram.title')}\n\n${mermaidCode}\n`;
                                        fullGeneratedContent += mermaidBlock;
                                        setMainContent(prev => (prev || '') + mermaidBlock);
                                        console.log("Mermaid block added successfully");
                                        mermaidSuccess = true;
                                    } else {
                                        console.warn("Invalid Mermaid content detail:", mermaidCode);

                                        // Still try to add it if it looks somewhat like code, but add a warning
                                        if (mermaidCode.length > 20) {
                                            const rawBlock = `\n\n### ${t('manuscript.diagram.title')}\n\n> ${t('manuscript.diagram.warning')}\n\n\`\`\`mermaid\n${mermaidCode.replace(/```/g, '')}\n\`\`\`\n`;
                                            fullGeneratedContent += rawBlock;
                                            setMainContent(prev => (prev || '') + rawBlock);
                                            mermaidSuccess = true; // Mark as success so we don't retry unnecessarily if model is just confused
                                        } else {
                                            throw new Error("Invalid Mermaid content (too short or missing tags)");
                                        }
                                    }
                                } catch (mermaidErr) {
                                    console.error(`Mermaid attempt ${mermaidAttempt} failed:`, mermaidErr);
                                    if (mermaidAttempt === MAX_RETRIES) {
                                        console.warn("Failed to generate Mermaid diagram after all retries");
                                    }
                                }
                            }
                        }
                    }

                    // Final Save
                    if (fullGeneratedContent) {
                        // Save to Firebase
                        const docId = currentManuscriptId || `manuscript_${Date.now()}`;
                        const title = currentManuscriptId
                            ? savedManuscripts.find(m => m.id === currentManuscriptId)?.title
                            : t('manuscript.default_title', { date: new Date().toLocaleDateString() });

                        const finalContent = (currentManuscriptId ? (mainContent || '') : '') + fullGeneratedContent;

                        // If appending to existing, make sure we use the right base. 
                        // Actually, setMainContent was appending locally. Let's trust fullGeneratedContent as the *new* part.
                        // But if we are editing an EXISTING manuscript, we need to append to its *previous* content.
                        // The loop above did: setMainContent(prev => (prev || '') + newSectionBlock);
                        // So 'mainContent' state is already updated progressively.
                        // However, 'fullGeneratedContent' only contains the NEW text.
                        // For the SAVE, we should probably grab the latest state or just append.
                        // Safest is to read the LATEST 'mainContent' state, but state updates might be async.
                        // So let's rely on constructing it manually:
                        // If new doc: finalContent = fullGeneratedContent
                        // If existing doc: finalContent = (prevContent) + fullGeneratedContent. 
                        // Wait, 'mainContent' in this scope is the value at START of render. It's stale!

                        // Fix: We need to use a Ref or just assume we rely on 'fullGeneratedContent' combined with what we knew at start.
                        // 'mainContent' is from scope.
                        const contentToSave = (mainContent || '') + fullGeneratedContent;

                        await saveDocument(user!.uid, 'manuscripts', {
                            id: docId,
                            title: title || t('manuscript.untitled_proposal'),
                            content: contentToSave,
                            updatedAt: new Date().toISOString()
                        }, projectId);

                        // If it was a new manuscript, update state
                        if (!currentManuscriptId) {
                            setCurrentManuscriptId(docId);
                            const manuscripts = await loadCollection(user!.uid, 'manuscripts', projectId);
                            setSavedManuscripts(manuscripts);
                        }

                        setMainContent(contentToSave); // Ensure consistent
                        setSidebarView('main'); // Switch to editor view

                        setMessages(prev => [...prev, { role: 'model', content: t('manuscript.success.drafted', { type: isFullProposal ? t('manuscript.full') : t('manuscript.methods_only') }) }]);
                    }

                    setIsLoading(false);
                    return;
                }


                newMessages.push({ role: 'system', content: t('mindmap.status.starting_generation', { count: targetPapers.length }) });
                setMessages([...newMessages]);

                // Determine categorization criteria from user input
                const userRequestLower = text.toLowerCase();
                let categorizationCriteria = t('mindmap.criteria.default');
                if (!userRequestLower.includes("請為選定的資料庫建立心智圖") && !userRequestLower.includes("mind map")) {
                    // If user typed something specific, try to use it as criteria
                    categorizationCriteria = text;
                }

                // Refine criteria string
                const criteriaPrompt = t('mindmap.criteria.refined', { criteria: categorizationCriteria });

                newMessages.push({ role: 'system', content: t('mindmap.status.phase1', { criteria: categorizationCriteria }) });
                setMessages([...newMessages]);

                const allPapersContext = targetPapers.map((p: any) => `Title: ${p.title}\nAbstract: ${p.abstract}`).join('\n---\n').substring(0, 100000);

                const phase1Prompt = `Analyze these ${targetPapers.length} research papers and identify the ${criteriaPrompt}.
                Structure them into a Hierarchical Taxonomy (Mind Map).
                
                Input Papers:
                ${allPapersContext}

                CRITICAL OUTPUT FORMAT:
                Return a strictly valid JSON object representing the tree structure.
                Each node must have "id" (unique string), "label", and optional "children" array.
                Example:
                {
                  "id": "root", "label": "Category Overview", "children": [
                    { "id": "cat1", "label": "Category 1", "children": [ ... ] },
                    { "id": "cat2", "label": "Category 2", "children": [ ... ] }
                  ]
                }
                
                Rules:
                1. Root ID must be "root".
                2. IDs should be short and descriptive.
                3. Create 2-3 levels of depth max.
                4. Cover all papers.`;

                let hierarchyRoot: any = { id: 'root', label: t('mindmap.root_label'), children: [] };
                let flatCategories: { id: string, label: string }[] = [];

                try {
                    const res1 = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            model: 'gemini-3-flash-preview',
                            task: 'summary',
                            prompt: phase1Prompt
                        })
                    });
                    const data1 = await res1.json();
                    if (!data1.text) throw new Error(data1.details || "No text returned from Gemini");
                    const jsonStr = (data1.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
                    hierarchyRoot = JSON.parse(jsonStr);

                    // Fallback if root is missing or wrong format
                    if (!hierarchyRoot.id) hierarchyRoot = { id: 'root', label: t('mindmap.root_label'), children: Array.isArray(hierarchyRoot) ? hierarchyRoot : [] };

                    // Flatten for Phase 2 logic (we need a list of ALL candidate target nodes)
                    const traverse = (node: any) => {
                        flatCategories.push({ id: node.id, label: node.label });
                        if (node.children) node.children.forEach(traverse);
                    };
                    traverse(hierarchyRoot);

                } catch (e) {
                    console.error("Phase 1 Failed", e);
                    // Fallback
                    hierarchyRoot = {
                        id: 'root', label: t('mindmap.root_label'),
                        children: [
                            { id: 'cat_a', label: t('mindmap.fallback_category_a') },
                            { id: 'cat_b', label: t('mindmap.fallback_category_b') }
                        ]
                    };
                    flatCategories = [{ id: 'root', label: 'Root' }, { id: 'cat_a', label: t('mindmap.fallback_category_a') }, { id: 'cat_b', label: t('mindmap.fallback_category_b') }];
                }

                // Phase 2: Assign Papers to Categories (Chunked)
                newMessages.push({ role: 'system', content: t('mindmap.status.phase2', { count: flatCategories.length }) });
                setMessages([...newMessages]);

                const chunkSize = 15;
                const chunks = [];
                for (let i = 0; i < targetPapers.length; i += chunkSize) {
                    chunks.push(targetPapers.slice(i, i + chunkSize));
                }

                const assignments: { paperIndex: number, targetNodeId: string }[] = [];

                // Process chunks sequentially or parallel (sequential safer for rate limits?)
                await Promise.all(chunks.map(async (chunk, chunkIdx) => {
                    const chunkPrompt = `Classify these 15 papers into the provided Taxonomy based on "${categorizationCriteria}".
                    
                    Taxonomy Nodes (ID: Label):
                    ${flatCategories.map(c => `${c.id}: ${c.label}`).join('\n')}

                    Papers:
                    ${chunk.map((p: any, idx) => `[ID:${chunkIdx * chunkSize + idx}] ${p.title} (${p.abstract?.substring(0, 100)}...)`).join('\n')}

                    Task:
                    For each paper, find the MOST SPECIFIC node ID in the taxonomy to attach it to.
                    
                    Return JSON: [{"id": 0, "targetNodeId": "cat1"}, ...] (Use the Paper ID provided)
                    If unsure, use "root".`;

                    try {
                        const res2 = await fetch('/api/gemini', {
                            method: 'POST',
                            body: JSON.stringify({
                                model: 'gemini-3-flash-preview',
                                task: 'summary',
                                prompt: chunkPrompt
                            })
                        });
                        const data2 = await res2.json();
                        const jsonStr = data2.text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const chunkAssignments = JSON.parse(jsonStr);
                        if (Array.isArray(chunkAssignments)) {
                            chunkAssignments.forEach((a: any) => {
                                assignments.push({ paperIndex: a.id, targetNodeId: a.targetNodeId });
                            });
                        }
                    } catch (e) {
                        console.error(`Phase 2 Chunk ${chunkIdx} failed`, e);
                    }
                }));

                // 3. Construct Node Structure Programmatically

                // Prefix for this batch to allow multiple trees in one map
                const idPrefix = `batch_${Date.now()}_`;
                const nodes: any[] = [];

                // Helper to convert Hierarchy to Nodes
                const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
                let colorIdx = 0;

                const processHierarchy = (node: any, parentId: string | null, depth: number) => {
                    // Unique ID for this run
                    const uniqueId = idPrefix + node.id;
                    const uniqueParent = parentId ? (idPrefix + parentId) : null;

                    // Assign color only to top-level branches (depth 1)
                    let color = '#3b82f6'; // root color
                    if (depth === 1) {
                        color = colors[colorIdx % colors.length];
                        colorIdx++;
                    } else if (depth > 1) {
                        color = '#64748b'; // Leaf nodes greyish
                    }

                    nodes.push({
                        id: uniqueId,
                        type: 'mindMap',
                        label: node.label,
                        color: node.id === 'root' ? '#3b82f6' : (depth === 1 ? color : undefined),
                        parent: uniqueParent
                    });

                    if (node.children) {
                        node.children.forEach((child: any) => processHierarchy(child, node.id, depth + 1));
                    }
                };

                processHierarchy(hierarchyRoot, null, 0);

                // Paper Nodes
                assignments.forEach(assign => {
                    const paper = targetPapers[assign.paperIndex];
                    if (!paper) return;

                    // Verify target exists in original categories list (which has raw IDs), else fallback to root
                    const targetExists = flatCategories.some(c => c.id === assign.targetNodeId);
                    const rawTargetId = targetExists ? assign.targetNodeId : 'root';

                    // Construct unique parent ID
                    const finalParent = idPrefix + rawTargetId;

                    nodes.push({
                        id: `${idPrefix}p-${assign.paperIndex}`,
                        type: 'reference',
                        label: `[${t('mindmap.paper_label')}] #${assign.paperIndex + 1} ${paper.title}`, // Standard Format
                        parent: finalParent,
                        data: {
                            referenceType: 'paper',
                            paperDoi: paper.doi,
                            paperAbstract: paper.abstract,
                            isCompact: false, // Show rich details by default
                            isCollapsed: true // For tree structure initially
                        }
                    });
                });

                // === REUSED AUTO LAYOUT ALGORITHM ===
                const autoLayout = (simpleNodes: any[]) => {
                    if (!simpleNodes || simpleNodes.length === 0) return { nodes: [], edges: [] };

                    const childrenMap: Record<string, string[]> = {};
                    const nodeMap: Record<string, any> = {};
                    let rootId = '';

                    simpleNodes.forEach(n => {
                        nodeMap[n.id] = n;
                        if (!n.parent) {
                            rootId = n.id;
                        } else {
                            if (!childrenMap[n.parent]) childrenMap[n.parent] = [];
                            childrenMap[n.parent].push(n.id);
                        }
                    });

                    if (!rootId && simpleNodes.length > 0) rootId = simpleNodes[0].id;

                    const HORIZONTAL_GAP = 350; // Increased ease spacing
                    const VERTICAL_SPACING = 40; // Spacing between nodes
                    const ROOT_X = 450;
                    const ROOT_Y = 350;

                    const heightMap: Record<string, number> = {};

                    // 1. Calculate Subtree Heights
                    const calculateHeight = (nodeId: string): number => {
                        const children = childrenMap[nodeId] || [];
                        const node = nodeMap[nodeId];
                        // Base height depends on node type
                        const baseHeight = node.type === 'reference' ? 140 : 60;

                        if (children.length === 0) {
                            heightMap[nodeId] = baseHeight;
                            return baseHeight;
                        }

                        let totalHeight = 0;
                        children.forEach(cid => {
                            totalHeight += calculateHeight(cid);
                        });
                        // Add spacing between children
                        totalHeight += (children.length - 1) * VERTICAL_SPACING;

                        // The height of this subtree is essentially the max of its content or its children span
                        // But for layout purposes, we care about the children span primarily
                        heightMap[nodeId] = Math.max(baseHeight, totalHeight);
                        return heightMap[nodeId];
                    };

                    calculateHeight(rootId);

                    const positions: Record<string, { x: number, y: number }> = {};

                    // 2. Layout Nodes
                    const layoutNode = (nodeId: string, x: number, y: number, direction: 'left' | 'right' | 'down') => {
                        positions[nodeId] = { x, y };
                        const children = childrenMap[nodeId] || [];
                        if (children.length === 0) return;

                        const totalChildrenHeight = heightMap[nodeId];
                        let currentY = y - (totalChildrenHeight / 2);

                        children.forEach((cid, idx) => {
                            const childH = heightMap[cid];
                            const childCenterY = currentY + (childH / 2);
                            const childX = direction === 'left' ? x - HORIZONTAL_GAP :
                                direction === 'right' ? x + HORIZONTAL_GAP : x;

                            const childDirection = nodeId === rootId
                                ? (idx % 2 === 0 ? 'left' : 'right')
                                : direction;

                            layoutNode(cid, childX, childCenterY, childDirection);
                            currentY += childH + VERTICAL_SPACING;
                        });
                    };

                    // Let's force everything to the Right for simplicity and "List View" created by "Mind Map", 

                    // Recalculate Root Split
                    const rootChildren = childrenMap[rootId] || [];
                    const leftChildren = rootChildren.filter((_, i) => i % 2 === 0);
                    const rightChildren = rootChildren.filter((_, i) => i % 2 !== 0);

                    // Calc heights for split
                    let leftTotalH = 0;
                    leftChildren.forEach(cid => { leftTotalH += heightMap[cid] + VERTICAL_SPACING; });

                    let rightTotalH = 0;
                    rightChildren.forEach(cid => { rightTotalH += heightMap[cid] + VERTICAL_SPACING; });

                    positions[rootId] = { x: ROOT_X, y: ROOT_Y };

                    // Layout Left
                    let leftY = ROOT_Y - (leftTotalH / 2) + (VERTICAL_SPACING / 2); // approximate center
                    leftChildren.forEach(cid => {
                        const h = heightMap[cid];
                        layoutNode(cid, ROOT_X - HORIZONTAL_GAP, leftY + (h / 2), 'left');
                        leftY += h + VERTICAL_SPACING;
                    });

                    // Layout Right
                    let rightY = ROOT_Y - (rightTotalH / 2) + (VERTICAL_SPACING / 2);
                    rightChildren.forEach(cid => {
                        const h = heightMap[cid];
                        layoutNode(cid, ROOT_X + HORIZONTAL_GAP, rightY + (h / 2), 'right');
                        rightY += h + VERTICAL_SPACING;
                    });


                    const finalNodes = simpleNodes.map(n => ({
                        id: n.id,
                        type: n.type || 'mindMap',
                        position: positions[n.id] || { x: 100, y: 100 },
                        data: {
                            label: n.label,
                            color: n.color,
                            referenceType: n.type === 'reference' ? 'paper' : undefined
                        }
                    }));

                    // ... Edges logic ...
                    const edges: any[] = [];
                    simpleNodes.forEach(n => {
                        if (n.parent && positions[n.id] && positions[n.parent]) {
                            const childPos = positions[n.id];
                            const parentPos = positions[n.parent];
                            let sourceHandle = 'bottom';
                            let targetHandle = 'top';

                            if (childPos.x < parentPos.x - 50) {
                                sourceHandle = 'left';
                                targetHandle = 'right';
                            } else if (childPos.x > parentPos.x + 50) {
                                sourceHandle = 'right';
                                targetHandle = 'left';
                            } else if (childPos.y < parentPos.y) {
                                sourceHandle = 'top';
                                targetHandle = 'bottom';
                            }

                            edges.push({
                                id: `e-${n.parent}-${n.id}`,
                                source: n.parent,
                                target: n.id,
                                sourceHandle,
                                targetHandle,
                                type: 'default',
                                animated: false
                            });
                        }
                    });

                    return { nodes: finalNodes, edges };
                };

                const layoutResult = autoLayout(nodes);

                if (layoutResult.nodes.length > 0) {
                    setMapKey(Date.now().toString());

                    // Conflict Resolution: Append to existing map
                    let finalNodes = layoutResult.nodes;
                    let finalEdges = layoutResult.edges;

                    try {
                        if (mindMapCode) {
                            const existingData = typeof mindMapCode === 'string' ? JSON.parse(mindMapCode) : mindMapCode;
                            if (existingData.nodes && existingData.nodes.length > 0) {
                                const existingMaxX = Math.max(...existingData.nodes.map((n: any) => n.position.x));
                                const offsetX = existingMaxX + 1500;

                                finalNodes = finalNodes.map(n => ({
                                    ...n,
                                    position: {
                                        ...n.position,
                                        x: n.position.x + offsetX
                                    }
                                }));

                                finalNodes = [...existingData.nodes, ...finalNodes];
                                finalEdges = [...existingData.edges, ...finalEdges];
                            }
                        }
                    } catch (e) {
                        console.error("Failed to merge with existing map", e);
                    }

                    // Save logic scoped to Project
                    const newValue = JSON.stringify({ nodes: finalNodes, edges: finalEdges });
                    setMindMapCode(newValue);

                    // Trigger sidebar and save
                    setSidebarView('map');

                    // Save to project data
                    saveProjectData(user!.uid, 'currentMap', { data: newValue }, projectId);

                    setMessages(prev => [...prev, {
                        role: 'model',
                        content: t('mindmap.success.generated', {
                            categories: flatCategories.length,
                            papers: targetPapers.length
                        })
                    }]);
                } else {
                    setMessages(prev => [...prev, { role: 'model', content: t('mindmap.error.generation_failed') }]);
                }

                setIsLoading(false);
                return; // End here for group processing
            }

            // Check if this is a literature search request
            // LEGACY: Disabled in favor of AI Intent Detection Flow (Step 0)
            const isLiteratureSearch = false;
            /*
            const isLiteratureSearch = text.toLowerCase().includes('文獻') ||
                text.toLowerCase().includes('paper') ||
                text.toLowerCase().includes('literature') ||
                text.toLowerCase().includes('research on') ||
                (text.toLowerCase().includes('find') && (text.toLowerCase().includes('article') || text.toLowerCase().includes('study')));
            */

            const isSearch = text.toLowerCase().startsWith('find') || text.toLowerCase().includes('search') || text.toLowerCase().includes('找') || isLiteratureSearch;
            let systemContext = '';

            // Add file content to context if provided
            let fileContext = '';
            if (fileContent) {
                // Truncate very large files to avoid token limits
                const truncatedContent = fileContent.length > 50000 ? fileContent.substring(0, 50000) + '\n\n[... content truncated due to length ...]' : fileContent;
                fileContext = `\n\n[UPLOADED FILE: ${fileName}]\n${truncatedContent}\n[END OF FILE]`;
            }

            if (isLiteratureSearch) {
                // Full hybrid search - put results in Research panel
                newMessages.push({ role: 'system', content: t('search.status.starting_hybrid') });
                setMessages([...newMessages]);

                // Helper: Generate PDF link
                const generatePdfLink = (title: string, doi: string) => {
                    if (doi) return `https://doi.org/${doi}`;
                    return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
                };

                // Fetch from Scopus
                const fetchScopus = async (searchQuery: string, limit: number) => {
                    try {
                        const currentYear = new Date().getFullYear();
                        const dateFilter = `PUBYEAR > ${currentYear - 5} AND PUBYEAR < ${currentYear + 1}`;
                        // Use TITLE-ABS-KEY for better accuracy
                        const fullQuery = `TITLE-ABS-KEY(${searchQuery}) AND ${dateFilter}`;
                        const res = await fetch(`/api/scopus?q=${encodeURIComponent(fullQuery)}&count=${limit}`);
                        const data = await res.json();

                        if (data.error) {
                            console.error("Scopus API Error:", data.error, data.details);
                            return [];
                        }

                        // Map entries
                        return (data['search-results']?.entry || []).map((entry: any) => ({
                            id: entry['dc:identifier']?.split(':')[1] || Math.random().toString(),
                            title: entry['dc:title'],
                            authors: entry['dc:creator'] || 'Unknown',
                            source: entry['prism:publicationName'],
                            year: entry['prism:coverDate'] ? entry['prism:coverDate'].substring(0, 4) : 'N/A',
                            doi: entry['prism:doi'],
                            link: generatePdfLink(entry['dc:title'], entry['prism:doi']),
                            abstract: entry['dc:description'] || 'No abstract available.',
                            keywords: '' // Scopus search results often don't have keywords inline
                        }));
                    } catch (e) {
                        console.error("Scopus fetch failed", e);
                        return [];
                    }
                };

                // 1. Identify keywords with Gemini
                const keywordRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: model,
                        task: 'summary',
                        prompt: `Extract 3-5 distinct, high-quality academic search keywords from this request for Scopus/Google Scholar.
                        Return ONLY a JSON array of strings.
                        Request: "${text}"`,
                        history: []
                    })
                });
                const keywordData = await keywordRes.json();
                let keywords: string[] = [];
                try {
                    keywords = JSON.parse(keywordData.text.replace(/```json/g, '').replace(/```/g, ''));
                } catch {
                    keywords = [text.replace('find papers about', '').trim()];
                }

                // 2. Parallel Search (Scopus)
                // Use Grounding with Gemini 3 Pro
                newMessages.push({ role: 'system', content: t('search.status.searching_keywords', { keywords: keywords.join(', ') }) });
                setMessages([...newMessages]);

                const scopusResults = await fetchScopus(keywords.join(' OR '), 10);

                // Gemini Grounding Search (for latest/web content)
                let geminiSearchResults = [];
                try {
                    const groundingRes = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            model: 'gemini-3-pro-preview', // Enforce Pro for grounding
                            task: 'summary',
                            prompt: `Find 5 recent high-quality academic papers about "${keywords.join(' ')}". Return JSON list with title, authors, year, abstract, link.`,
                            history: [],
                            useGrounding: true
                        })
                    });
                    const groundingData = await groundingRes.json();
                    // Parse grounding results if structured, or just use text?
                    // Assuming API returns text, we might need to parse.
                    // For now, let's rely mostly on Scopus + maybe some fake/parsed items if we updated API to return parsed items.
                    // Actually, let's just use Scopus as primary.
                    // IMPORTANT: Previous turn instructions mentioned enforcing grounding for paper search.
                } catch (e) {
                    console.error("Grounding search failed", e);
                }


                // Merge Results (dedup based on Title)
                const combinedResults: any[] = [...scopusResults]; // Add Gemini results if we parsed them

                setCurrentResearchResults(combinedResults);
                setSidebarView('research');
                setIsLoading(false);
                setMessages(prev => [...prev, { role: 'model', content: t('search.status.found_papers', { count: combinedResults.length }) }]);
                return;
            } else {
                // Normal Chat
                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: model,
                        task: 'chat',
                        prompt: text + fileContext,
                        history: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
                    })
                });

                const data = await res.json();
                const aiMessage = { role: 'model', content: data.text } as Message;
                const updatedMessages = [...newMessages, aiMessage];
                setMessages(updatedMessages);

                // Auto-save chat to project
                if (projectId && user) {
                    saveProjectData(user.uid, 'currentChat', { messages: updatedMessages }, projectId);
                }
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', content: t('chat.error.response_failed') }]);
        } finally {
            setIsLoading(false);
        }
    };


    // Sidebar Handlers (Project Scoped)


    const handleCreateGroup = (name: string) => {
        if (!user || !projectId) return;
        const newGroup = {
            id: `group-${Date.now()}`,
            name,
            papers: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setResearchGroups(prev => [newGroup, ...prev]);
        setCurrentGroupId(newGroup.id);
        setCurrentResearchResults([]);
        saveDocument(user.uid, 'researchGroups', newGroup, projectId);
    };

    const handleRenameGroup = (groupId: string, newName: string) => {
        if (!user || !projectId) return;
        setResearchGroups(prev => {
            const updated = prev.map(g => g.id === groupId ? { ...g, name: newName, updatedAt: new Date().toISOString() } : g);
            const group = updated.find(g => g.id === groupId);
            if (group) saveDocument(user.uid, 'researchGroups', group, projectId);
            return updated;
        });
    };

    const handleDeleteGroup = (groupId: string) => {
        if (!user || !projectId) return;

        // Remove from state
        setResearchGroups(prev => {
            const updated = prev.filter(g => g.id !== groupId);
            return updated;
        });

        // Delete from Firebase
        deleteDocument(user.uid, 'researchGroups', groupId, projectId);

        // Switch group if deleted was current
        if (currentGroupId === groupId) {
            const remaining = researchGroups.filter(g => g.id !== groupId);
            if (remaining.length > 0) {
                setCurrentGroupId(remaining[0].id);
                setCurrentResearchResults(remaining[0].papers || []);
            } else {
                setCurrentGroupId(null);
                setCurrentResearchResults([]);
            }
        }
    };

    const handleGroupChange = (groupId: string) => {
        const group = researchGroups.find(g => g.id === groupId);
        if (group) {
            setCurrentGroupId(groupId);
            setCurrentResearchResults(group.papers || []);
        }
    };

    const handleGroupAutoSave = (papers: any[]) => {
        if (!currentGroupId || !user || !projectId) return;
        setResearchGroups(prev => {
            return prev.map(g => g.id === currentGroupId ? { ...g, papers, updatedAt: new Date().toISOString() } : g);
        });
        // We defer the actual save to the debounce effect in ResearchPanel, but we update local state here
        // Actually ResearchPanel calls onAutoSave which should probably trigger the save...
        // ResearchPanel handles saving to firebase directly via onAutoSave usually? 
        // Wait, the ResearchPanel uses 'onAutoSave' which calls 'handleGroupAutoSave'.
        // Let's ensure we save to Firestore here too or rely on ResearchPanel?
        // Current implementation of 'handleGroupAutoSave' only updates state. 
        // ResearchPanel has a debounce effect that might be saving, or we should save here.
        // Assuming ResearchPanel's debounced save is for `results` state, but let's just make sure we save the group here.
        const group = researchGroups.find(g => g.id === currentGroupId);
        if (group) {
            saveDocument(user.uid, 'researchGroups', { ...group, papers, updatedAt: new Date().toISOString() }, projectId);
        }
    };

    const handleMovePapers = async (papers: ResearchArticle[], targetGroupId: string) => {
        if (!user || !projectId) return;

        setResearchGroups((prev: ResearchGroup[]) => {
            const newGroups = prev.map((g: ResearchGroup) => ({ ...g, papers: [...g.papers] })); // Deep copy structure
            const targetG = newGroups.find((g: ResearchGroup) => g.id === targetGroupId);
            if (!targetG) return prev;

            // Add papers to target group (avoiding duplicates)
            const existingIds = new Set(targetG.papers.map((p: ResearchArticle) => p.id));
            papers.forEach((p: ResearchArticle) => {
                if (!existingIds.has(p.id)) {
                    targetG.papers.push(p);
                }
            });
            targetG.updatedAt = new Date().toISOString();

            // Remove from current group (if currentGroupId is set)
            if (currentGroupId && currentGroupId !== targetGroupId) {
                const currentG = newGroups.find((g: ResearchGroup) => g.id === currentGroupId);
                if (currentG) {
                    currentG.papers = currentG.papers.filter((p: ResearchArticle) => !papers.some((moved: ResearchArticle) => moved.id === p.id));
                    currentG.updatedAt = new Date().toISOString();
                }
            }

            // Save changes
            saveDocument(user.uid, 'researchGroups', targetG, projectId);

            if (currentGroupId && currentGroupId !== targetGroupId) {
                const currentG = newGroups.find((g: ResearchGroup) => g.id === currentGroupId);
                if (currentG) saveDocument(user.uid, 'researchGroups', currentG, projectId);
            }

            return newGroups;
        });

        // Update current results if we are viewing the source group
        if (currentGroupId && currentGroupId !== targetGroupId) {
            setCurrentResearchResults((prev: ResearchArticle[]) => prev.filter((p: ResearchArticle) => !papers.some((moved: ResearchArticle) => moved.id === p.id)));
        }
    };


    // --- OTHER HANDLERS (Drafts, Maps, etc.) ---
    // need to scope these to projectId as well
    const handleNewDraft = () => {
        setCurrentDraftId(null);
        setPaperContent('');
        setSidebarView('draft');
    };
    // --- AI Helpers ---
    const handleAskAI = async (command: string, section: string) => {
        setIsLoading(true);
        try {
            setLoadingStatus("Thinking...");
            const res = await fetch('/api/gemini', {
                method: 'POST',
                body: JSON.stringify({ task: 'summary', prompt: command === 'structure' ? `Generate concise academic paper structure (Markdown).` : `Write content for section '${section}'. \nPaper:\n${paperContent}` })
            });
            const data = await res.json();
            setPaperContent(prev => prev + '\n' + data.text);
        } catch (e) { } finally { setIsLoading(false); }
    };

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

    const handleNewManuscript = () => {
        setCurrentManuscriptId(null);
        setMainContent('');
        setSidebarView('main');
    };

    // Auto-Save Draft
    useEffect(() => {
        if (!paperContent || !user || !projectId) return;

        const timer = setTimeout(async () => {
            const now = new Date();
            const newId = currentDraftId || now.getTime().toString();

            // Check if we need to generate a title
            let title = '';
            const existing = savedDrafts.find(d => d.id === newId);

            if (existing) {
                title = existing.title;
            } else {
                const aiTitle = await generateAiTitle(paperContent, 'Draft');
                title = aiTitle || paperContent.split('\n')[0].substring(0, 10) || t('draft.new_draft');
            }

            setSavedDrafts(prev => {
                const draftData = {
                    id: newId,
                    title,
                    content: paperContent,
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString()
                };

                const others = prev.filter(d => d.id !== newId);
                const updated = [draftData, ...others];

                if (!isReadOnly && targetUserId) saveDocument(targetUserId, 'drafts', draftData, projectId);
                if (!currentDraftId) setCurrentDraftId(newId);

                return updated;
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [paperContent, currentDraftId, savedDrafts, user, projectId]);

    // Auto-Save Manuscript
    useEffect(() => {
        // Guard: Need user and project. 
        if (!user || !projectId) return;
        // Guard: If it's a NEW manuscript (no ID) and empty, don't save yet.
        // But if it HAS an ID, we must save even if empty (user deleted text).
        if (!currentManuscriptId && (!mainContent || !mainContent.trim())) return;

        setSaveStatus('saving');

        const timer = setTimeout(async () => {
            const now = new Date();
            const newId = currentManuscriptId || `manuscript_${now.getTime()}`;

            // Check if we need to generate a title
            let title = '';
            const existing = savedManuscriptsRef.current.find(m => m.id === newId);

            if (existing) {
                title = existing.title;
            } else {
                title = t('manuscript.default_title', { date: now.toLocaleDateString() });
                if (mainContent && mainContent.length > 5) {
                    const firstLine = mainContent.split('\n').find(l => l.trim().length > 0) || '';
                    if (firstLine) title = firstLine.replace(/[#*]/g, '').trim().substring(0, 20);
                }
            }

            setSavedManuscripts(prev => {
                const docData = {
                    id: newId,
                    title,
                    content: mainContent || '', // Ensure empty string if null
                    updatedAt: new Date().toISOString()
                };

                const others = prev.filter(m => m.id !== newId);
                const updated = [docData, ...others];

                if (!isReadOnly && targetUserId) {
                    saveDocument(targetUserId, 'manuscripts', docData, projectId)
                        .then(() => {
                            console.log(`Saved manuscript ${newId}`);
                            setSaveStatus('saved');
                        })
                        .catch(err => {
                            console.error("Failed to save manuscript", err);
                            setSaveStatus('error');
                        });
                } else {
                    setSaveStatus('saved');
                }

                if (!currentManuscriptId) setCurrentManuscriptId(newId);

                return updated;
            });
        }, 800); // Reduced debounce for safer saving

        return () => clearTimeout(timer);
    }, [mainContent, currentManuscriptId, user, projectId]);

    // Rename Handler
    const handleRename = async (collectionType: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', id: string, newTitle: string) => {
        if (!user || !projectId) return;

        const collectionMap: Record<string, CollectionName> = {
            'draft': 'drafts',
            'map': 'maps',
            'chat': 'chats',
            'manuscript': 'manuscripts',
            'research': 'research'
        };
        const collectionName = collectionMap[collectionType];
        if (!collectionName) return;

        const updateList = (list: any[], setList: any, collection: CollectionName) => {
            const item = list.find(i => i.id === id);
            if (item) {
                const updatedItem = { ...item, title: newTitle, updatedAt: new Date().toISOString() };
                setList(list.map(i => i.id === id ? updatedItem : i));
                if (!isReadOnly && targetUserId) saveDocument(targetUserId, collection, updatedItem, projectId);
            }
        };

        if (collectionType === 'draft') updateList(savedDrafts, setSavedDrafts, 'drafts');
        if (collectionType === 'map') updateList(savedMaps, setSavedMaps, 'maps');
        if (collectionType === 'chat') updateList(savedChats, setSavedChats, 'chats');
        if (collectionType === 'manuscript') updateList(savedManuscripts, setSavedManuscripts, 'manuscripts');
        if (collectionType === 'research') updateList(savedResearch, setSavedResearch, 'research');
    };


    // ... Maps Loading/Saving ...
    // Memoize the parsed data to prevent SystemMapPanel from resetting on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const parsedMindMapData = React.useMemo(() => {
        if (!mindMapCode) return null;
        try {
            return typeof mindMapCode === 'string' ? JSON.parse(mindMapCode) : mindMapCode;
        } catch (e) {
            console.error("Failed to parse mind map code", e);
            return null;
        }
    }, [mindMapCode]);

    // Use a map key to force reload in SystemMapPanel when generating/loading new maps
    const [mapKey, setMapKey] = useState<string>('');
    useEffect(() => {
        if (!mapKey) setMapKey(currentMapId || `map-${Date.now()}`);
    }, [currentMapId, mapKey]);

    // Auto save map
    // Auto-save Main Chat Messages
    useEffect(() => {
        if (!messages || messages.length === 0 || !user || !projectId) return;

        const canSave = isOwner || (!isReadOnly && targetUserId);
        if (!canSave || !targetUserId) return;

        const timer = setTimeout(() => {
            saveProjectData(targetUserId, 'currentChat', { messages }, projectId)
                .then(() => console.log("Chat Saved"))
                .catch(e => console.error("Chat Save Failed", e));
        }, 3000);

        return () => clearTimeout(timer);
    }, [messages, user, projectId, targetUserId, isOwner, isReadOnly]);

    // Auto save map
    const handleAutoSaveMap = React.useCallback((mapData: { nodes: any[], edges: any[] }) => {
        const { nodes, edges } = mapData;

        // Safeguard: Do not save if empty (prevents overwriting good data with init state)
        if (nodes.length === 0) {
            console.log("Skipping save: Empty nodes");
            return;
        }

        const data = JSON.stringify({ nodes, edges });
        setMindMapCode(data);
        if (user && projectId) {
            console.log("Attempting AutoSave Map:", { isReadOnly, targetUserId, isOwner });

            // Allow save if we are owner OR if public editing is allowed
            const canSave = isOwner || (!isReadOnly && targetUserId);

            if (canSave && targetUserId) {
                saveProjectData(targetUserId, 'currentMap', { data }, projectId)
                    .then(() => console.log("Map ProjectData Saved Successfully"))
                    .catch(e => console.error("Map Save Failed", e));
            } else {
                console.warn("Save blocked", { isOwner, isReadOnly, targetUserId });
            }
        }

        // Also save to 'maps' collection as history
        if (user && projectId) {
            const now = new Date();
            const newId = currentMapId || now.getTime().toString();

            const sanitizeForFirestore = (obj: any): any => {
                try {
                    return JSON.parse(JSON.stringify(obj, (key, value) => {
                        if (typeof value === 'function') return undefined;
                        if (key.startsWith('__')) return undefined;
                        return value;
                    }));
                } catch (e) { return []; }
            };

            setSavedMaps(prev => {
                const existing = prev.find(m => m.id === newId);
                const title = existing?.title || t('map.default_title', { date: now.toLocaleDateString() });

                const newMap = {
                    id: newId,
                    title,
                    nodes: sanitizeForFirestore(nodes),
                    edges: sanitizeForFirestore(edges),
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString()
                };

                const others = prev.filter(m => m.id !== newId);
                const updated = [newMap, ...others];

                // Save inside the callback to ensure state is fresh
                const canSave = isOwner || (!isReadOnly && targetUserId);
                if (canSave && targetUserId) {
                    saveDocument(targetUserId, 'maps', newMap, projectId)
                        .then(() => console.log("History Map Saved"))
                        .catch(e => console.error("History Save Failed", e));
                }

                return updated;
            });

            if (!currentMapId) setCurrentMapId(newId);
        }
    }, [user, projectId, isReadOnly, targetUserId, currentMapId]);

    const handleAutoSaveChats = React.useCallback((chats: any) => {
        // Safeguard: Do not save if empty object
        if (!chats || Object.keys(chats).length === 0) return;

        setActiveNodeChats(chats);
        // Persist to project data
        if (user && projectId) {
            const now = new Date();
            const newId = currentChatsId || now.getTime().toString();

            setSavedChats(prev => {
                const existing = prev.find(c => c.id === newId);
                const title = existing?.title || t('chat.default_title', { date: now.toLocaleDateString() });

                const newChats = {
                    id: newId,
                    title,
                    chats,
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString()
                };

                const others = prev.filter(c => c.id !== newId);
                const updated = [newChats, ...others];

                if (!isReadOnly && targetUserId) saveDocument(targetUserId, 'chats', newChats, projectId);
                return updated;
            });

            if (!currentChatsId) setCurrentChatsId(newId);
        }
    }, [user, projectId, isReadOnly, targetUserId, currentChatsId]);

    // HISTORY HANDLERS
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
            setMapKey(Date.now().toString());
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

    // Citation Normalizer Helper
    const normalizeCitations = (content: string) => {
        if (!content) return content;
        // 1. Unescape escaped brackets if present: \[ID:1\] -> [ID:1]
        let processed = content.replace(/\\\[ID:([\d\s,]+)\\\]/g, '[ID:$1]');
        // 2. Convert [ID:x, y] -> [x, y]
        processed = processed.replace(/\[ID:([\d\s,]+)\]/g, '[$1]');
        return processed;
    };

    const onLoadManuscript = (id: any) => {
        const m = savedManuscripts.find(d => d.id === id);
        if (m) {
            // Apply normalization on load
            const cleanContent = normalizeCitations(m.content);
            setMainContent(cleanContent);
            setCurrentManuscriptId(m.id);
            setSidebarView('main');
            setHistoryOpen(false);
        }
    };

    // Deletion Handlers
    const onDeleteDraft = (id: string) => {
        setSavedDrafts(prev => prev.filter(d => d.id !== id));
        if (!isReadOnly && targetUserId) deleteDocument(targetUserId, 'drafts', id, projectId);
        if (currentDraftId === id) {
            setCurrentDraftId(null);
            setPaperContent('');
        }
    };

    const onDeleteMap = (id: string) => {
        setSavedMaps(prev => prev.filter(m => m.id !== id));
        if (!isReadOnly && targetUserId) deleteDocument(targetUserId, 'maps', id, projectId);
        if (currentMapId === id) {
            setCurrentMapId(null);
            setMindMapCode(null);
        }
    };

    const onDeleteChats = (id: string) => {
        setSavedChats(prev => prev.filter(c => c.id !== id));
        if (!isReadOnly && targetUserId) deleteDocument(targetUserId, 'chats', id, projectId);
        if (currentChatsId === id) {
            setCurrentChatsId(null);
            setActiveNodeChats(null);
        }
    };

    const onDeleteManuscript = (id: string) => {
        if (!isReadOnly && targetUserId) deleteDocument(targetUserId, 'manuscripts', id, projectId);
        setSavedManuscripts(prev => prev.filter(m => m.id !== id));
        if (currentManuscriptId === id) {
            setCurrentManuscriptId(null);
            setMainContent('');
        }
    };

    // Research Handlers
    const handleSaveResearch = (results: any[]) => {
        if (!user || !projectId) return;
        const now = new Date();
        const newId = currentResearchId || now.getTime().toString();
        const title = t('research.default_title', { date: now.toLocaleDateString(), count: results.length });

        setSavedResearch(prev => {
            const item = {
                id: newId,
                title,
                results,
                createdAt: now.toISOString(),
                date: now.toISOString()
            };
            const others = prev.filter(r => r.id !== newId);
            const updated = [item, ...others];
            if (!isReadOnly && targetUserId) saveDocument(targetUserId, 'research', item, projectId);
            if (!currentResearchId) setCurrentResearchId(newId);
            return updated;
        });
    };

    const onLoadResearch = (id: string) => {
        const item = savedResearch.find(r => r.id === id);
        if (item) {
            setCurrentResearchResults(item.results);
            setCurrentResearchId(item.id);
            setSidebarView('research');
            setHistoryOpen(false);
        }
    };

    const onDeleteResearch = (id: string) => {
        setSavedResearch(prev => prev.filter(r => r.id !== id));
        if (!isReadOnly && targetUserId) deleteDocument(targetUserId, 'research', id, projectId);
        if (currentResearchId === id) {
            setCurrentResearchId(null);
            setCurrentResearchResults([]);
        }
    };


    if (loading || !user) {
        return (
            <div className="h-screen flex items-center justify-center bg-background" suppressHydrationWarning={true}>
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div suppressHydrationWarning className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 relative">
            {/* Back to Previous Page Button */}
            <button
                onClick={() => {
                    const fromPath = searchParams.get('from');
                    router.push(fromPath || '/dashboard');
                }}
                className="fixed top-4 left-4 z-[60] p-2 bg-white/50 dark:bg-black/50 backdrop-blur rounded-full hover:bg-white dark:hover:bg-black transition-all shadow-sm border border-border/50"
                title={t('common.back')}
            >
                <ArrowLeft size={20} />
            </button>

            {/* History Sidebar */}
            <HistorySidebar
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                savedDrafts={savedDrafts}
                savedMaps={savedMaps}
                savedChats={savedChats}
                savedManuscripts={savedManuscripts}
                onLoadDraft={onLoadDraft}
                onLoadMap={onLoadMap}
                onLoadChats={onLoadChats}
                onLoadManuscript={onLoadManuscript}
                onDeleteDraft={onDeleteDraft}
                onDeleteMap={onDeleteMap}
                onDeleteChats={onDeleteChats}
                onDeleteManuscript={onDeleteManuscript}
                savedResearch={savedResearch}
                onLoadResearch={onLoadResearch}
                onDeleteResearch={onDeleteResearch}
                onRename={handleRename}
                onNewDraft={handleNewDraft}
                onNewManuscript={handleNewManuscript}
            />

            {/* Toggle History Button - Draggable */}
            <div
                className={`fixed right-0 z-[55] transform transition-transform duration-300 ${historyOpen ? 'translate-x-full' : 'translate-x-0'}`}
                style={{ top: `${historyButtonY}%` }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startTop = historyButtonY;
                    let hasMoved = false;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaY = Math.abs(moveEvent.clientY - startY);
                        if (deltaY > 5) hasMoved = true; // Threshold for drag detection

                        const newTop = Math.min(90, Math.max(10, startTop + ((moveEvent.clientY - startY) / window.innerHeight) * 100));
                        setHistoryButtonY(newTop);
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);

                        // Only toggle if it was a click (no significant movement)
                        if (!hasMoved) {
                            setHistoryOpen(!historyOpen);
                        }
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                }}
            >
                <div className="bg-white dark:bg-neutral-800 border border-border/50 p-2 rounded-l-xl shadow-lg cursor-grab active:cursor-grabbing">
                    <div className="text-xs font-medium tracking-widest uppercase text-muted-foreground py-2 flex items-center gap-2 font-serif" style={{ writingMode: 'vertical-rl' }}>
                        <span>{t('project.history')}</span>
                    </div>
                </div>
            </div>


            {/* Search / Chat Area */}
            <div className={`flex-1 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${sidebarView !== 'none' ? `mr-[${sidebarWidth}%]` : ''} relative z-10`} style={sidebarView !== 'none' ? { marginRight: `${sidebarWidth}%` } : {}} onClick={() => sidebarView !== 'none' && setSidebarView(sidebarView)}>

                {/* Minimal Header with Glass Effect */}
                <header className="absolute top-0 left-0 right-0 h-20 px-8 flex justify-between items-center z-20 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all duration-300 pl-16">
                    {/* Added pl-16 to avoid overlap with back button */}
                    <div className="flex items-center space-x-3">
                        {projectDetails ? (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorClasses(projectDetails.color || 'blue').bg} ${getColorClasses(projectDetails.color || 'blue').text}`}>
                                {React.createElement(getIconComponent(projectDetails.icon || 'Folder'), { size: 20 })}
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                        )}
                        <div onClick={() => router.push('/dashboard')} className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity">
                            {/* Hidden on mobile if sidebar logic requires, but generally we want to show it. */}
                            {/* Reverting hidden logic to simple responsive if needed, or keeping as user had it. */}
                            {/* User requested simple logo replacement, let's keep text simple. */}
                            <span className="font-medium tracking-tight mr-4 font-serif hidden md:block">Venalium</span>
                            {projectDetails ? (
                                <span className="text-xs text-muted-foreground">{projectDetails.name}</span>
                            ) : (
                                <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded mt-1" />
                            )}
                        </div>

                        {/* User Profile - Client Side Only to prevent hydration mismatch */}
                        {mounted && user && (
                            <div className="flex items-center gap-3 pl-4 border-l border-neutral-200 dark:border-neutral-800">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="User"
                                        className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                        {(user.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                                <div className={`hidden md:flex flex-col ${sidebarView !== 'none' ? 'hidden' : ''}`}>
                                    <span className="text-xs font-medium max-w-[100px] truncate">{user.displayName || 'User'}</span>
                                    <button onClick={() => signOut()} className="text-[10px] text-muted-foreground hover:text-red-500 text-left transition-colors">
                                        {t('common.sign_out')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full border border-black/5 dark:border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'draft' ? 'none' : 'draft'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'draft' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('project.tabs.draft')}
                        >
                            <FileText size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>{t('project.tabs.draft')}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'map' ? 'none' : 'map'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'map' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('project.tabs.map')}
                        >
                            <MapIcon size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>{t('project.tabs.map')}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'main' ? 'none' : 'main'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'main' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('project.tabs.manuscript')}
                        >
                            <BookOpen size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>{t('project.tabs.manuscript')}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'research' ? 'none' : 'research'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'research' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title={t('project.tabs.research')}
                        >
                            <SearchIcon size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>{t('project.tabs.research')}</span>
                        </button>
                    </div>
                </header>

                {/* Dynamic Content */}
                <main className="flex-1 flex flex-col overflow-y-auto w-full max-w-3xl mx-auto pt-24 px-6 pb-0 scrollbar-hide">
                    {/* Dynamic Greeting */}
                    {messages.length === 0 && (
                        <div className="min-h-[40vh] flex flex-col justify-end pb-8 animate-fade-in">
                            <h1 className="text-5xl md:text-6xl font-serif font-light tracking-tight mb-4 leading-[1.1] animate-fade-in-up">
                                {t('project.greeting.what_shall_we')} <br />
                                <span className="italic text-muted-foreground animate-fade-in-up-delay">{t('project.greeting.research_today')}</span>
                            </h1>
                            <p className="text-lg text-muted-foreground font-light max-w-md">
                                {projectDetails ? t('project.greeting.project_name', { name: projectDetails.name }) : ''}
                                {t('project.greeting.description')}
                            </p>
                        </div>
                    )}

                    {/* Chat Interface */}
                    <div className="flex-1 min-h-0 flex flex-col relative">
                        <ChatInterface
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            isLoading={isLoading}
                            loadingStatus={loadingStatus}
                            researchGroups={researchGroups}
                            currentGroupId={currentGroupId}
                            articles={latestSearchResults}
                            onConfirmSearch={(config) => executeLiteratureSearch(config)}
                            onStopGeneration={handleStopGeneration}
                            onCancelSearch={(config, chatOnly) => {
                                setIsLoading(false);
                                setLoadingStatus('');
                                if (chatOnly && config?.originalMessage) {
                                    // Fallback to normal chat response
                                    // Filter out any confirmation widgets from history
                                    const cleanHistory = messages.filter(m => m.type !== 'search-confirmation');
                                    setIsLoading(true);

                                    if (abortControllerRef.current) abortControllerRef.current.abort();
                                    abortControllerRef.current = new AbortController();

                                    processChatResponse(config.originalMessage, '', cleanHistory);
                                }
                            }}
                        />
                    </div>
                </main>

                {/* Dark Mode Toggle */}
                {mounted && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
                        className="absolute bottom-6 left-6 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/20 transition-all z-20"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                )}
            </div>

            {/* Sidebar Container - Resizable */}
            <div
                style={{ width: `${sidebarWidth}%` }}
                className={`fixed inset-y-0 right-0 bg-background border-l border-border/50 shadow-2xl z-30 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] glass-panel ${sidebarView !== 'none' ? 'translate-x-0' : 'translate-x-full'} ${isResizing ? 'transition-none' : ''}`}
            >
                {/* Resize Handle */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-50 group"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        const startX = e.clientX;
                        const startWidth = sidebarWidth;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                            const delta = startX - moveEvent.clientX;
                            const newWidth = Math.min(80, Math.max(25, startWidth + (delta / window.innerWidth) * 100));
                            setSidebarWidth(newWidth);
                        };
                        const handleMouseUp = () => {
                            setIsResizing(false);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-neutral-300 dark:bg-neutral-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {sidebarView === 'draft' && (
                    <PaperWriter
                        content={paperContent}
                        setContent={setPaperContent}
                        onAskAI={async (t: string) => handleSendMessage(t)}
                    />
                )}

                {sidebarView === 'map' && (
                    <SystemMapPanel
                        mindMapData={parsedMindMapData}
                        onSave={handleAutoSaveMap}
                        initialNodeChats={activeNodeChats}
                        onSaveChats={handleAutoSaveChats}
                        availableGroups={researchGroups}
                        mapKey={mapKey}
                    />
                )}

                {sidebarView === 'main' && (
                    <PaperProvider value={{ papers: researchGroups.flatMap(g => g.papers || []) }}>
                        <MainEditor
                            content={mainContent}
                            setContent={setMainContent}
                            saveStatus={saveStatus}
                        />
                    </PaperProvider>
                )}

                {sidebarView === 'research' && (
                    <ResearchPanel
                        key={currentGroupId || currentResearchId || 'new'}
                        onClose={() => setSidebarView('none')}
                        initialResults={currentResearchResults}
                        onSave={handleSaveResearch}
                        groups={researchGroups}
                        currentGroupId={currentGroupId}
                        onGroupChange={handleGroupChange}
                        onCreateGroup={handleCreateGroup}
                        onRenameGroup={handleRenameGroup}
                        onDeleteGroup={handleDeleteGroup}
                        onAutoSave={handleGroupAutoSave}
                        onMovePapers={handleMovePapers}
                        projectName={projectDetails?.name}
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

