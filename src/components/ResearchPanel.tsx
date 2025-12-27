import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, FileText, ExternalLink, Loader2, Table, Download, Play, BookOpen, Calendar, Save, Trash2, FolderPlus, ChevronDown, Upload, Edit2, X, FileSearch, Eye } from 'lucide-react';
import { useAnalysis } from '@/context/AnalysisContext';
import { useAuth } from '@/lib/auth';
import { useParams, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import FileChatPanel from '@/components/FileChatPanel';
import { TeamFile } from '@/lib/firestore';

export interface ResearchGroup {
    id: string;
    name: string;
    papers: ResearchArticle[];
    driveFolderId?: string;
}

interface ResearchPanelProps {
    onClose?: () => void;
    initialResults?: ResearchArticle[];
    onSave?: (results: ResearchArticle[]) => void;
    // Group management props
    groups?: ResearchGroup[];
    currentGroupId?: string | null;
    onGroupChange?: (groupId: string) => void;
    onCreateGroup?: (name: string) => void;
    onRenameGroup?: (groupId: string, newName: string) => void;
    onDeleteGroup?: (groupId: string) => void;
    onAutoSave?: (papers: ResearchArticle[]) => void;
    projectName?: string; // For hierarchical folder structure
}

export interface ResearchArticle {
    id: string;
    authors: string;
    title: string;
    source: string;
    year: string;
    pages?: string;
    doi: string;
    link: string; // PDF Search Link
    keywords: string;
    abstract: string;
    methodology?: string;
    pdfUrl?: string | null; // Google Drive PDF URL after upload
    pdfStatus?: 'searching' | 'failed' | 'success' | null;
    sourceModel?: string; // 'scopus' | 'gemini-2.0-flash' | 'gemini-3-pro-preview' etc.
}

export default function ResearchPanel({ onClose, initialResults, onSave, groups = [], currentGroupId, onGroupChange, onCreateGroup, onRenameGroup, onDeleteGroup, onAutoSave, projectName }: ResearchPanelProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ResearchArticle[]>(initialResults || []);
    const [isLoading, setIsLoading] = useState(false);


    // const [isAnalyzing, setIsAnalyzing] = useState(false); // Refactored to global context
    const [progress, setProgress] = useState('');

    // Global Context
    const { startAnalysis, startCheckPdf, state: analysisState } = useAnalysis();
    const { user } = useAuth();
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params?.projectId as string;
    const targetUserId = searchParams.get('ownerId') || user?.uid;

    const isInternalAnalyzing = analysisState.isAnalyzing && analysisState.progress.message.includes('Analyzing'); // Local check if needed, but handled by global widget mostly.
    // However, if we want to show status locally too:
    // We can use analysisState.

    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [showNewGroupInput, setShowNewGroupInput] = useState(false);
    const [isHeaderOpen, setIsHeaderOpen] = useState(true);

    // Sync results with parent when initialResults changes (e.g. new search)
    useEffect(() => {
        if (initialResults) {
            setResults(prev => {
                if (JSON.stringify(prev) === JSON.stringify(initialResults)) return prev;
                return initialResults;
            });
        }
    }, [initialResults]);

    // Initial Default Group Check
    useEffect(() => {
        if (groups && groups.length === 0 && onCreateGroup && !currentGroupId) {
            // Only create if we really have no groups and haven't selected one
            // Use a small timeout to avoid double mounting issues in React Strict Mode
            const timer = setTimeout(() => {
                if (groups.length === 0) {
                    onCreateGroup(groups.length === 0 ? "預設" : "New Group");
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [groups, onCreateGroup, currentGroupId]);

    // Rename State
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    const handleSubmitRename = () => {
        if (currentGroupId && renameValue.trim()) {
            onRenameGroup?.(currentGroupId, renameValue.trim());
            setIsRenaming(false);
        }
    };

    // Year Filter State (Default: Recent 3 years)
    const currentYear = new Date().getFullYear();
    const [startYear, setStartYear] = useState(currentYear - 3);
    const [endYear, setEndYear] = useState(currentYear + 1);

    // Customizable paper counts
    const [scopusCount, setScopusCount] = useState(15);
    const [geminiCount, setGeminiCount] = useState(15);

    // PDF upload state
    const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    // PDF preview state
    const [previewArticle, setPreviewArticle] = useState<ResearchArticle | null>(null);
    const [showPdfChat, setShowPdfChat] = useState(false);

    // Find PDF Confirmation State
    const [showFindPdfConfirm, setShowFindPdfConfirm] = useState(false);
    const [retryFailedPdfs, setRetryFailedPdfs] = useState(false);

    // Google Apps Script URL for Drive backup
    const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

    // Auto-save ref to prevent duplicate writes
    const lastSavedRef = useRef<string>('');

    // Auto-save effect: save to Firebase when results change
    // Using longer debounce to prevent Firestore write exhaustion
    useEffect(() => {
        if (onAutoSave && results.length > 0) {
            // Helper to sanitize object for Firestore (remove undefined)
            const sanitizeForFirestore = (obj: any): any => {
                if (Array.isArray(obj)) {
                    return obj.map(sanitizeForFirestore);
                } else if (obj !== null && typeof obj === 'object') {
                    const newObj: any = {};
                    Object.keys(obj).forEach(key => {
                        const val = obj[key];
                        if (val !== undefined) {
                            newObj[key] = sanitizeForFirestore(val);
                        }
                    });
                    return newObj;
                }
                return obj;
            };

            const sanitizedResults = sanitizeForFirestore(results);
            const currentStr = JSON.stringify(sanitizedResults);

            // Only save if content changed significantly
            if (currentStr === lastSavedRef.current) return;

            const timer = setTimeout(() => {
                lastSavedRef.current = currentStr;
                onAutoSave(sanitizedResults);
            }, 3000); // Debounce 3 seconds to prevent write exhaustion
            return () => clearTimeout(timer);
        }
    }, [results, onAutoSave]);

    // Update results when initialResults changes (group switch)
    useEffect(() => {
        if (initialResults) {
            setResults(initialResults);
        }
    }, [initialResults]);

    const generatePdfLink = (title: string, doi?: string) => {
        // Use DOI link if available (same as main chat interface)
        if (doi) return `https://doi.org/${doi}`;
        return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
    };

    // Handle PDF file upload to Google Drive via GAS
    const handlePdfUpload = async (file: File, articleId: string) => {
        if (!GAS_URL) {
            alert('Google Apps Script URL not configured');
            return;
        }

        setUploadingPdfId(articleId);

        try {
            // Fetch driveFolderId from Firestore for the current group
            let parentId: string | undefined;
            if (currentGroupId && targetUserId && projectId) {
                try {
                    const groupRef = doc(db, `users/${targetUserId}/projects/${projectId}/researchGroups`, currentGroupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        parentId = groupSnap.data()?.driveFolderId;
                    }
                } catch (e) {
                    console.warn('Failed to fetch group folder ID for upload', e);
                }
            }

            // Convert file to Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = async () => {
                const base64Content = (reader.result as string).split(',')[1];
                const article = results.find(r => r.id === articleId);
                const filename = `paper_${article?.year || 'unknown'}_${article?.title?.substring(0, 30).replace(/[^a-z0-9]/gi, '_') || articleId}.pdf`;

                // 檢查 base64 大小（原始檔案大小約為 base64 大小的 75%）
                const base64Size = base64Content.length;
                const estimatedSize = Math.floor(base64Size * 0.75);
                const MAX_SIZE = 35 * 1024 * 1024; // 35MB

                if (estimatedSize > MAX_SIZE) {
                    const sizeMB = Math.round(estimatedSize / 1024 / 1024);
                    alert(`PDF 檔案太大 (${sizeMB}MB)！\n\n目前支援的最大檔案大小為 35MB。\n\n建議：\n1. 使用 PDF 壓縮工具減小檔案大小\n2. 直接上傳到 Google Drive 並複製分享連結`);
                    setUploadingPdfId(null);
                    setSelectedArticleId(null);
                    return;
                }

                setProgress(`⬆️ Uploading PDF (${Math.round(estimatedSize / 1024 / 1024)}MB)...`);

                try {
                    // Use local proxy API to bypass CORS
                    const response = await fetch('/api/upload-pdf', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'upload',
                            filename: filename,
                            mimeType: 'application/pdf',
                            fileContent: base64Content,
                            parentId: parentId // Pass folder ID to GAS
                        })
                    });

                    // Try to parse the response
                    let driveUrl = '';
                    const result = await response.json();

                    // 檢查錯誤狀態
                    if (!response.ok) {
                        console.error('Upload failed:', result);
                        if (result.message) {
                            alert(`上傳失敗：${result.message}`);
                        } else if (result.error === 'File too large') {
                            alert(`PDF 檔案太大！建議使用 PDF 壓縮工具或直接上傳到 Google Drive。`);
                        } else if (result.error === 'GAS authentication error') {
                            alert(`Google Apps Script 認證錯誤。\n\n${result.suggestion || '請確認 GAS 設定正確。'}`);
                        } else {
                            alert(`上傳失敗：${result.error || 'Unknown error'}`);
                        }
                        setUploadingPdfId(null);
                        setSelectedArticleId(null);
                        return;
                    }

                    if (result.status === 'success') {
                        // 優先使用 embedUrl（如果 GAS 提供），否則從 URL 或 fileId 建構
                        if (result.embedUrl) {
                            driveUrl = result.embedUrl;
                        } else if (result.fileId) {
                            driveUrl = `https://drive.google.com/file/d/${result.fileId}/preview`;
                        } else if (result.url) {
                            // 嘗試從現有 URL 提取 fileId 並轉換為預覽格式
                            const idMatch = result.url.match(/[?&]id=([^&]+)/) || result.url.match(/\/d\/([^/]+)/);
                            if (idMatch) {
                                driveUrl = `https://drive.google.com/file/d/${idMatch[1]}/preview`;
                            } else {
                                driveUrl = result.url;
                            }
                        }

                        // Update article with the Drive URL
                        const newArticleState = (prev: ResearchArticle[]) => prev.map(a =>
                            a.id === articleId
                                ? { ...a, pdfUrl: driveUrl, pdfStatus: 'success' as const }
                                : a
                        );

                        setResults(prev => {
                            const updated = newArticleState(prev);
                            // Trigger immediate save to prevent data loss on refresh
                            if (onAutoSave) {
                                onAutoSave(updated);
                            }
                            return updated;
                        });

                        setProgress(`✅ PDF uploaded: ${article?.title?.substring(0, 40)}...`);
                    } else {
                        console.log('GAS response:', result);
                        alert(`上傳可能未成功。請檢查 Google Drive 確認檔案是否已上傳。`);
                    }

                } catch (error) {
                    console.error('PDF upload error:', error);
                    alert('PDF 上傳失敗。請檢查網路連線和 GAS 設定。');
                }

                setUploadingPdfId(null);
                setSelectedArticleId(null);
            };

            reader.onerror = () => {
                alert('Failed to read file');
                setUploadingPdfId(null);
            };

        } catch (error) {
            console.error('PDF upload error:', error);
            setUploadingPdfId(null);
        }
    };

    const handleDeletePdf = async (articleId: string) => {
        if (!confirm('Are you sure you want to remove this PDF link?')) return;

        setResults(prev => prev.map(a =>
            a.id === articleId ? { ...a, pdfUrl: null, pdfStatus: null } : a
        ));

        // Trigger auto-save via effect
    };

    const fetchScopus = async (searchQuery: string, limit: number, offset: number = 0): Promise<ResearchArticle[]> => {
        if (limit <= 0) return []; // Skip if limit is 0
        try {
            // Scopus Advanced Search Syntax for better accuracy:
            // TITLE-ABS-KEY() searches in title, abstract and keywords for more relevant results
            const dateFilter = `PUBYEAR > ${startYear - 1} AND PUBYEAR < ${endYear + 1}`;
            const fullQuery = `TITLE-ABS-KEY(${searchQuery}) AND ${dateFilter}`;

            // Use start parameter to skip already fetched papers (offset is 0-indexed)
            const res = await fetch(`/api/scopus?q=${encodeURIComponent(fullQuery)}&count=${limit}&start=${offset}`);
            const data = await res.json();

            // Check for API errors
            if (data.error) {
                console.error("Scopus API Error:", data.error, data.details);
                return [];
            }

            const entries = data['search-results']?.['entry'] || [];
            console.log("Scopus Entries:", entries); // DEBUG log

            if (entries.length === 1 && entries[0].error) {
                console.warn("Scopus returned an error object as entry:", entries[0]);
                return [];
            }

            return entries.filter((e: any) => e['dc:title']).map((e: any) => {
                const title = e['dc:title'];
                const doi = e['prism:doi'] || '';
                let pageCount = 'N/A';
                if (e['prism:pageRange']) {
                    const parts = e['prism:pageRange'].split('-');
                    if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
                        pageCount = (parseInt(parts[1]) - parseInt(parts[0]) + 1).toString();
                    }
                }
                return {
                    id: e['dc:identifier'] || `scopus-${Math.random()}`,
                    authors: e['dc:creator'] || 'Unknown',
                    title: title || 'Untitled',
                    source: e['prism:publicationName'] || '',
                    year: e['prism:coverDate'] ? e['prism:coverDate'].substring(0, 4) : '',
                    pages: pageCount,
                    doi: doi,
                    link: generatePdfLink(title || 'paper', doi),
                    keywords: '',
                    abstract: e['dc:description'] || '',
                    methodology: '',
                    sourceModel: 'scopus'
                };
            });
        } catch (e) {
            console.error("Scopus Error", e);
            return [];
        }
    };

    const fetchGemini = async (searchQuery: string, limit: number): Promise<ResearchArticle[]> => {
        if (limit <= 0) return []; // Skip if limit is 0
        try {
            // Prompt for Gemini to generate bibliography - emphasize JSON-only output
            const prompt = `You are a research assistant. Use Google Search to find ${limit} REAL, EXISTING, and VERIFIED academic papers (${startYear}-${endYear}) about: "${searchQuery}".
            
IMPORTANT: 
- Use the "googleSearch" tool to verify the existence of each paper.
- Do NOT hallucinate papers. If you cannot find ${limit} real papers, return fewer.
- Respond with ONLY a valid JSON object. No explanations.

Required JSON format:
{"articles":[{"authors":"Author Name","title":"Paper Title","source":"Journal Name","year":"2024","abstract":"摘要（繁體中文）","doi":"10.xxxx/xxxxx"}]}

Return up to ${limit} verified papers in this exact JSON format. The abstract MUST be in Traditional Chinese (繁體中文).`;

            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    task: 'summary', // Use summary task for single-shot generation
                    prompt: prompt,
                    history: [],
                    useGrounding: true
                })
            });

            if (!res.ok) {
                console.error("Gemini API response not ok:", res.status, res.statusText);
                return [];
            }

            const data = await res.json();

            // Check for error response
            if (data.error) {
                console.error("Gemini API error:", data.error, data.details);
                return [];
            }

            if (!data.text) {
                console.warn("Gemini returned no text:", data);
                return [];
            }

            // Try to extract JSON from the response
            let jsonStr = data.text;

            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

            // Try to find JSON object in the response
            const jsonMatch = jsonStr.match(/\{[\s\S]*"articles"[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            // If it doesn't look like JSON, skip
            if (!jsonStr.startsWith('{')) {
                console.warn("Gemini did not return JSON:", jsonStr.substring(0, 100));
                return [];
            }

            const parsed = JSON.parse(jsonStr);

            return (parsed.articles || []).map((e: any, i: number) => ({
                id: `gen-gemini-${i}-${Date.now()}`,
                authors: e.authors || 'Unknown',
                title: e.title,
                source: e.source || 'Unknown Source',
                year: e.year || 'N/A',
                pages: 'N/A',
                doi: e.doi || '',
                link: generatePdfLink(e.title, e.doi),
                keywords: '',
                abstract: e.abstract || '',
                methodology: '',
                sourceModel: 'gemini-2.5-flash'
            }));
        } catch (e) {
            console.error("Gemini Search Error", e);
            // Return empty array instead of failing completely, so Scopus results still show
            return [];
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setProgress('Translating keywords...');

        try {
            // Use Gemini to translate Chinese keywords to English
            let searchKeyword = query.trim();

            // Check if query contains non-ASCII characters (likely Chinese)
            const hasNonAscii = /[^\x00-\x7F]/.test(query);
            if (hasNonAscii) {
                try {
                    const topicRes = await fetch('/api/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gemini-2.0-flash',
                            task: 'summary',
                            prompt: `Convert the following user request into a single clean English search keyword phrase for academic literature search. Only output the keywords, nothing else. No quotes, no explanation.
User request: "${query}"
Examples:
- "找金融科技的論文" -> fintech financial technology
- "機器學習股票預測" -> machine learning stock prediction
- "永續發展" -> sustainable development ESG
- "財務與永續" -> financial sustainability corporate finance
Output only the keywords:`
                        })
                    });
                    const topicData = await topicRes.json();
                    console.log("Gemini Translation Response:", topicData); // DEBUG log

                    if (topicData.text) {
                        searchKeyword = topicData.text.trim();
                        // Remove any quotes if present
                        searchKeyword = searchKeyword.replace(/^["']|["']$/g, '');
                        setProgress(`Translated: "${query}" → "${searchKeyword}"`);
                    } else {
                        console.warn("Gemini translation returned no result:", topicData);
                    }
                } catch (err) {
                    console.error('Keyword translation failed:', err);
                    // Continue with original query if translation fails
                }
            }

            console.log("Searching Scopus with keyword:", searchKeyword); // DEBUG log

            // Calculate offset based on existing Scopus papers to fetch NEW papers
            const existingScopusCount = results.filter(r => r.sourceModel === 'scopus').length;
            console.log(`Existing Scopus papers: ${existingScopusCount}, fetching from offset ${existingScopusCount}`); // DEBUG

            setProgress(`Fetching ${scopusCount} papers from Scopus (offset: ${existingScopusCount})...`);
            const scopusAction = fetchScopus(searchKeyword, scopusCount, existingScopusCount);

            setProgress(`Fetching ${geminiCount} papers from Gemini...`);
            const geminiAction = fetchGemini(searchKeyword, geminiCount);

            const [scopusResults, geminiResults] = await Promise.all([scopusAction, geminiAction]);

            // APPEND to existing results, deduplicate based on DOI or exact title
            // Build new combined array first, then update state
            setResults(prev => {
                const combined = [...prev];

                // Helper: Check if paper is duplicate
                const isDuplicate = (newPaper: ResearchArticle) => {
                    return combined.some(existing => {
                        // If both have DOI, compare DOI (most reliable)
                        if (existing.doi && newPaper.doi && existing.doi === newPaper.doi) {
                            return true;
                        }
                        // Otherwise, compare normalized titles (exact match after cleanup)
                        const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return normalizeTitle(existing.title) === normalizeTitle(newPaper.title);
                    });
                };

                // Add Scopus results
                let addedCount = 0;
                scopusResults.forEach(s => {
                    if (!isDuplicate(s)) {
                        combined.push(s);
                        addedCount++;
                    }
                });

                // Add Gemini results
                geminiResults.forEach(g => {
                    if (!isDuplicate(g)) {
                        combined.push(g);
                        addedCount++;
                    }
                });

                // Progress update only - auto-save is handled by useEffect debounce
                setProgress(`Added ${addedCount} new papers (${scopusResults.length} Scopus, ${geminiResults.length} Gemini). Total: ${combined.length} papers.`);

                return combined;
            });
        } catch (e) {
            console.error(e);
            setProgress('Search failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeDeeply = async () => {
        if (results.length === 0 || !user || !projectId || !targetUserId) return;

        // Use Global Context to start analysis
        // We pass the current results to fill gaps
        const groupIdToUse = currentGroupId || 'default'; // Ensure a group ID

        startAnalysis(results as any, projectId, groupIdToUse, targetUserId, (updatedArticle: any) => {
            setResults(prev => prev.map(p => p.id === updatedArticle.id ? { ...p, ...updatedArticle } : p));
        });
    };

    const exportCSV = () => {
        const headers = ['Authors', 'Title', 'Source', 'Year', 'Pages', 'DOI', 'PDF Link', 'Keywords', 'Methodology', 'Abstract'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => [
                `"${(r.authors || '').replace(/"/g, '""')}"`,
                `"${(r.title || '').replace(/"/g, '""')}"`,
                `"${(r.source || '').replace(/"/g, '""')}"`,
                r.year,
                r.pages,
                r.doi,
                r.link,
                `"${(r.keywords || '').replace(/"/g, '""')}"`,
                `"${(r.methodology || '').replace(/"/g, '""')}"`,
                `"${(r.abstract || '').replace(/"/g, '""')}"` // Removed truncation
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `literature_review_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
                {/* Hidden file input for PDF upload */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && selectedArticleId) {
                            handlePdfUpload(file, selectedArticleId);
                        }
                        e.target.value = ''; // Reset for next selection
                    }}
                />

                {/* Header */}
                <div className="h-14 min-h-[3.5rem] flex items-center justify-between px-6 border-b border-border/40 bg-muted/20">
                    <span className="text-sm font-medium flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-500" />
                        Literature Review <span className="text-xs text-muted-foreground bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full">Hybrid</span>
                        <button
                            onClick={() => setIsHeaderOpen(!isHeaderOpen)}
                            className="ml-2 p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-muted-foreground transition-colors"
                            title={isHeaderOpen ? "Collapse Header" : "Expand Header"}
                        >
                            {isHeaderOpen ? <ChevronDown size={16} /> : <ChevronDown size={16} className="-rotate-90" />}
                        </button>
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={exportCSV}
                            disabled={results.length === 0}
                            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded disabled:opacity-30 transition-colors"
                            title="Export CSV"
                        >
                            <Download size={16} />
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded">
                                <ExternalLink size={16} className="rotate-180" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Collapsible Search & Controls */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isHeaderOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {/* Group Selector - Always Visible */}
                    <div className="px-6 py-3 border-b border-border/40 bg-muted/10">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Group:</span>

                            {groups.length === 0 ? (
                                <div className="text-sm text-neutral-500 italic">No groups created</div>
                            ) : (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors min-w-[150px] justify-between"
                                    >
                                        <span className="truncate">{groups.find(g => g.id === currentGroupId)?.name || 'Select Group'}</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showGroupDropdown && (
                                        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-neutral-900 border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                                            {groups.map(group => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => {
                                                        onGroupChange?.(group.id);
                                                        setShowGroupDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex justify-between items-center ${currentGroupId === group.id ? 'bg-neutral-100 dark:bg-neutral-800 font-medium' : ''}`}
                                                >
                                                    <span className="truncate">{group.name}</span>
                                                    <span className="text-xs text-muted-foreground">{group.papers?.length || 0}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Group Actions */}
                            {currentGroupId && groups.find(g => g.id === currentGroupId) && (
                                <div className="flex items-center gap-1">
                                    {isRenaming ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                className="w-32 px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSubmitRename();
                                                    if (e.key === 'Escape') setIsRenaming(false);
                                                }}
                                            />
                                            <button onClick={handleSubmitRename} className="p-1 hover:bg-green-100 text-green-600 rounded"><Save size={14} /></button>
                                            <button onClick={() => setIsRenaming(false)} className="p-1 hover:bg-red-100 text-red-600 rounded"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    if (currentGroupId) {
                                                        const g = groups.find(g => g.id === currentGroupId);
                                                        if (g) {
                                                            setRenameValue(g.name);
                                                            setIsRenaming(true);
                                                        }
                                                    }
                                                }}
                                                className="p-1.5 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Rename Group"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (currentGroupId && confirm('Are you sure you want to delete this group?')) {
                                                        onDeleteGroup?.(currentGroupId);
                                                    }
                                                }}
                                                className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete Group"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="h-4 w-px bg-border/50 mx-1" />

                            <button
                                onClick={() => setShowNewGroupInput(true)}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            >
                                <FolderPlus size={14} /> New Group
                            </button>
                        </div>
                        {showNewGroupInput && (
                            <div className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Enter group name..."
                                    className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newGroupName.trim()) {
                                            onCreateGroup?.(newGroupName.trim());
                                            setNewGroupName('');
                                            setShowNewGroupInput(false);
                                        } else if (e.key === 'Escape') {
                                            setShowNewGroupInput(false);
                                            setNewGroupName('');
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (newGroupName.trim()) {
                                            onCreateGroup?.(newGroupName.trim());
                                            setNewGroupName('');
                                            setShowNewGroupInput(false);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}
                                    className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg text-sm hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-6 border-b border-border/40 space-y-4">
                        <div className="relative w-full">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search in list..."
                                className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-900 border border-transparent focus:border-blue-500 rounded-lg outline-none transition-all"
                            />
                            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {results.length > 0 && !isInternalAnalyzing && (
                                <>
                                    <button
                                        onClick={analyzeDeeply}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <Play size={12} fill="currentColor" /> Deep Analysis
                                    </button>
                                    <button
                                        onClick={() => setShowFindPdfConfirm(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <FileSearch size={12} /> Find PDFs
                                    </button>
                                </>
                            )}
                            {isInternalAnalyzing && (
                                <div className="flex items-center gap-1 text-xs text-purple-600 animate-pulse">
                                    <Loader2 size={12} className="animate-spin" /> Analyzing...
                                </div>
                            )}
                        </div>

                        <div className="flex items-center">
                            <div className="text-xs text-muted-foreground font-mono">
                                {progress || analysisState.progress.message}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Results with Horizontal Scroll */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left table-fixed">
                        <thead className="text-xs text-muted-foreground uppercase bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-3 font-medium w-[40px] text-center">#</th>
                                <th className="px-4 py-3 font-medium w-[200px]">Article Details</th>
                                <th className="px-2 py-3 font-medium w-[60px]">Metrics</th>
                                <th className="px-4 py-3 font-medium w-[250px]">Analysis (Abstract & Method)</th>
                                <th className="px-4 py-3 font-medium w-[80px] text-center">PDF</th>
                                <th className="px-2 py-3 font-medium w-[40px] text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {results.filter(
                                article =>
                                    !query ||
                                    article.title.toLowerCase().includes(query.toLowerCase()) ||
                                    (article.authors && article.authors.toLowerCase().includes(query.toLowerCase())) ||
                                    (article.keywords && article.keywords.toLowerCase().includes(query.toLowerCase())) ||
                                    (article.source && article.source.toLowerCase().includes(query.toLowerCase())) ||
                                    (article.year && String(article.year).includes(query)) ||
                                    (article.doi && article.doi.toLowerCase().includes(query.toLowerCase())) ||
                                    (article.abstract && article.abstract.toLowerCase().includes(query.toLowerCase())) ||
                                    (article.methodology && article.methodology.toLowerCase().includes(query.toLowerCase()))
                            ).map((article, index) => (
                                <tr key={article.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 group">
                                    {/* Row Number */}
                                    <td className="px-2 py-3 align-top text-center w-[40px]">
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full text-xs font-bold">
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top w-[200px]">
                                        <div className="font-medium text-foreground mb-1 leading-snug md:text-base selection:bg-blue-100 dark:selection:bg-blue-900" title={article.title}>
                                            {article.title}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            {article.authors} • <span className="italic text-blue-600 dark:text-blue-400">{article.source}</span>
                                        </div>
                                        {article.keywords && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {article.keywords.split(',').slice(0, 5).map((k, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] text-muted-foreground border border-neutral-200 dark:border-neutral-700">
                                                        {k.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 align-top text-muted-foreground text-xs space-y-1 w-[100px]">
                                        <div className="flex justify-between"><span>Year:</span> <span className="font-mono text-foreground">{article.year}</span></div>
                                        <div className="flex justify-between"><span>Pages:</span> <span className="font-mono">{article.pages}</span></div>
                                        <div className="flex justify-between gap-1">
                                            <span>DOI:</span>
                                            <span className="font-mono text-[10px] break-all">{article.doi || '-'}</span>
                                        </div>
                                        {(article.id.startsWith('gen-gemini') || (article.sourceModel && article.sourceModel.includes('gemini'))) && (
                                            <div className="mt-2 text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 px-1 py-0.5 rounded w-fit">Gemini Generated</div>
                                        )}
                                        {/* Scopus Badge */}
                                        {(article.sourceModel === 'scopus' || article.id.startsWith('scopus') || article.id.startsWith('SCOPUS_ID') || article.source === 'Scopus') && (
                                            <div className="mt-2 text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 px-1 py-0.5 rounded w-fit">Scopus</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top w-[250px]">
                                        <div className="space-y-3">
                                            {article.methodology ? (
                                                <div className="inline-block px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded border border-green-200 dark:border-green-800 text-xs font-medium">
                                                    {article.methodology}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/30 italic">Not Analyzed</span>
                                            )}
                                            {article.abstract && (
                                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                    {article.abstract}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-center pt-4">
                                        <div className="flex flex-col items-center gap-1">
                                            {/* Search PDF Link */}
                                            <a
                                                href={article.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="Search PDF on Google"
                                            >
                                                <Search size={14} />
                                            </a>

                                            {/* Upload / Status / Delete */}
                                            {uploadingPdfId === article.id ? (
                                                <Loader2 size={14} className="animate-spin text-orange-500" />
                                            ) : article.pdfStatus === 'failed' ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div
                                                        className="inline-flex p-1.5 text-red-500 bg-red-50 dark:bg-red-950/30 rounded cursor-help"
                                                        title="PDF Search Failed"
                                                    >
                                                        <X size={14} />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedArticleId(article.id);
                                                            fileInputRef.current?.click();
                                                        }}
                                                        className="inline-flex p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                                                        title="Manual Upload"
                                                    >
                                                        <Upload size={14} />
                                                    </button>
                                                </div>
                                            ) : article.pdfUrl ? (
                                                <div className="flex items-center gap-1">
                                                    {article.pdfUrl.startsWith('http') ? (
                                                        <>
                                                            <a
                                                                href={article.pdfUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                                title="Open PDF"
                                                            >
                                                                <Download size={14} />
                                                            </a>
                                                            <button
                                                                onClick={() => {
                                                                    setPreviewArticle(article);
                                                                    setShowPdfChat(true);
                                                                }}
                                                                className="inline-flex p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                                                                title="Preview & Chat with AI"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="text-[9px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded cursor-default" title={article.pdfUrl}>
                                                            ✓
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => handleDeletePdf(article.id)}
                                                        className="inline-flex p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        title="Remove PDF Link"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setSelectedArticleId(article.id);
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="inline-flex p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                                                    title="Upload PDF to Google Drive"
                                                >
                                                    <Upload size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3 align-top text-center pt-4">
                                        <button
                                            onClick={() => setResults(prev => prev.filter(a => a.id !== article.id))}
                                            className="inline-flex p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="刪除此文章"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PDF Preview Chat Panel - Portal to body for proper centering */}
            {showPdfChat && previewArticle && previewArticle.pdfUrl && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 bg-black/70 backdrop-blur-md" onClick={() => { setShowPdfChat(false); setPreviewArticle(null); }}>
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-[95vw] h-[95vh] overflow-hidden border border-border flex flex-col md:flex-row relative" onClick={(e) => e.stopPropagation()}>
                        {/* PDF Viewer */}
                        <div className="flex-1 flex flex-col h-full min-w-0">
                            <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-lg font-semibold truncate">{previewArticle.title}</h2>
                                    <p className="text-xs text-muted-foreground">{previewArticle.authors} • {previewArticle.year}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={previewArticle.pdfUrl} download target="_blank" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                                        <Download size={14} /> Download
                                    </a>
                                    <button onClick={() => { setShowPdfChat(false); setPreviewArticle(null); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-muted-foreground">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50 relative">
                                {(() => {
                                    // 將任何 Google Drive URL 轉換為可嵌入的預覽格式
                                    const getPdfEmbedUrl = (url: string): string => {
                                        if (!url) return '';

                                        // 如果已經是 /preview 格式，直接使用
                                        if (url.includes('/preview')) {
                                            return url;
                                        }

                                        // 嘗試從各種 Google Drive URL 格式提取 fileId
                                        let fileId = '';

                                        // 格式: https://drive.google.com/file/d/FILE_ID/view
                                        const fileMatch = url.match(/\/file\/d\/([^/]+)/);
                                        if (fileMatch) {
                                            fileId = fileMatch[1];
                                        }

                                        // 格式: https://drive.google.com/uc?export=download&id=FILE_ID
                                        const ucMatch = url.match(/[?&]id=([^&]+)/);
                                        if (!fileId && ucMatch) {
                                            fileId = ucMatch[1];
                                        }

                                        // 格式: https://drive.google.com/open?id=FILE_ID
                                        const openMatch = url.match(/open\?id=([^&]+)/);
                                        if (!fileId && openMatch) {
                                            fileId = openMatch[1];
                                        }

                                        if (fileId) {
                                            // 使用 Google Drive 的直接預覽格式
                                            return `https://drive.google.com/file/d/${fileId}/preview`;
                                        }

                                        // 如果無法解析，使用 Google Docs Viewer 作為後備方案
                                        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
                                    };

                                    const embedUrl = getPdfEmbedUrl(previewArticle.pdfUrl!);

                                    return (
                                        <iframe
                                            src={embedUrl}
                                            className="w-full h-full"
                                            title={previewArticle.title}
                                            allow="autoplay"
                                        />
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Chat Panel */}
                        <FileChatPanel
                            file={{
                                id: previewArticle.id,
                                name: previewArticle.title,
                                url: previewArticle.pdfUrl,
                                type: 'application/pdf',
                                size: 0,
                                parentId: null,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                uploadedBy: targetUserId || '',
                                uploadedAt: new Date()
                            } as TeamFile}
                            teamId={projectId || ''}
                            userId={targetUserId || ''}
                            onClose={() => {
                                setShowPdfChat(false);
                                setPreviewArticle(null);
                            }}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Find PDF Confirmation Modal */}
            {showFindPdfConfirm && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                    <FileSearch size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Start PDF Search?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        This will search directly for PDFs for papers missing them.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-border/50">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                        checked={retryFailedPdfs}
                                        onChange={(e) => setRetryFailedPdfs(e.target.checked)}
                                    />
                                    <div className="text-sm">
                                        <span className="font-medium">Retry previously failed papers</span>
                                        <p className="text-muted-foreground text-xs mt-0.5">
                                            If checked, we'll try again for papers marked as 'failed'. Useful if you updated the crawler logic.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowFindPdfConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (projectId && user?.uid && currentGroupId) {
                                            const groupName = groups.find(g => g.id === currentGroupId)?.name || 'Unknown Group';
                                            startCheckPdf(
                                                results,
                                                projectId as string,
                                                currentGroupId,
                                                user.uid,
                                                projectName || 'Unknown Project',
                                                groupName,
                                                (updatedArticle: ResearchArticle) => {
                                                    setResults(prev => prev.map(p => p.id === updatedArticle.id ? updatedArticle : p));
                                                },
                                                retryFailedPdfs // Pass retry flag
                                            );
                                            setShowFindPdfConfirm(false);
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                >
                                    Start Finding
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

