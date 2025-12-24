import React, { useState, useEffect } from 'react';
import { Search, FileText, ExternalLink, Loader2, Table, Download, Play, BookOpen, Calendar, Save, Trash2, FolderPlus, ChevronDown, Upload } from 'lucide-react';

interface ResearchGroup {
    id: string;
    name: string;
    papers: ResearchArticle[];
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
    onAutoSave?: (papers: ResearchArticle[]) => void;
}

interface ResearchArticle {
    id: string;
    authors: string;
    title: string;
    source: string;
    year: string;
    pages: string;
    doi: string;
    link: string; // PDF Search Link
    keywords: string;
    abstract: string;
    methodology?: string;
    pdfUrl?: string; // Google Drive PDF URL after upload
    sourceModel?: string; // 'scopus' | 'gemini-2.0-flash' | 'gemini-3-pro-preview' etc.
}

export default function ResearchPanel({ onClose, initialResults, onSave, groups = [], currentGroupId, onGroupChange, onCreateGroup, onAutoSave }: ResearchPanelProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ResearchArticle[]>(initialResults || []);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState('');
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [showNewGroupInput, setShowNewGroupInput] = useState(false);

    // Year Filter State (Default: Recent 3 years)
    const currentYear = new Date().getFullYear();
    const [startYear, setStartYear] = useState(currentYear - 3);
    const [endYear, setEndYear] = useState(currentYear);

    // Customizable paper counts
    const [scopusCount, setScopusCount] = useState(15);
    const [geminiCount, setGeminiCount] = useState(15);

    // PDF upload state
    const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    // Google Apps Script URL for Drive backup
    const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

    // Auto-save effect: save to Firebase when results change
    useEffect(() => {
        if (onAutoSave && results.length > 0) {
            const timer = setTimeout(() => {
                onAutoSave(results);
            }, 1000); // Debounce 1 seconds
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
            // Convert file to Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = async () => {
                const base64Content = (reader.result as string).split(',')[1];
                const article = results.find(r => r.id === articleId);
                const filename = `paper_${article?.year || 'unknown'}_${article?.title?.substring(0, 30).replace(/[^a-z0-9]/gi, '_') || articleId}.pdf`;

                try {
                    // Use local proxy API to bypass CORS
                    const response = await fetch('/api/upload-pdf', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filename: filename,
                            mimeType: 'application/pdf',
                            fileContent: base64Content
                        })
                    });

                    // Try to parse the response
                    let driveUrl = '';
                    try {
                        const result = await response.json();
                        if (result.status === 'success' && result.url) {
                            driveUrl = result.url;
                        } else {
                            console.log('GAS response:', result);
                            // If we can't get URL, create a search link to Drive
                            driveUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(filename)}`;
                        }
                    } catch {
                        // If JSON parsing fails, create a search link
                        driveUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(filename)}`;
                    }

                    // Update article with the Drive URL
                    setResults(prev => prev.map(a =>
                        a.id === articleId
                            ? { ...a, pdfUrl: driveUrl }
                            : a
                    ));

                    setProgress(`✅ PDF uploaded: ${article?.title?.substring(0, 40)}...`);

                } catch (error) {
                    console.error('PDF upload error:', error);
                    alert('PDF upload failed. Please check GAS configuration.');
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

    const fetchScopus = async (searchQuery: string, limit: number): Promise<ResearchArticle[]> => {
        if (limit <= 0) return []; // Skip if limit is 0
        try {
            // Scopus Advanced Search Syntax for better accuracy:
            // TITLE-ABS-KEY() searches in title, abstract and keywords for more relevant results
            const dateFilter = `PUBYEAR > ${startYear - 1} AND PUBYEAR < ${endYear + 1}`;
            const fullQuery = `TITLE-ABS-KEY(${searchQuery}) AND ${dateFilter}`;

            const res = await fetch(`/api/scopus?q=${encodeURIComponent(fullQuery)}&count=${limit}`);
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
            // Prompt for Gemini to generate bibliography
            const prompt = `Generate a bibliography of exactly ${limit} recent academic papers (published between ${startYear} and ${endYear}) related to: "${searchQuery}".
            Prioritize papers not indexed in standard free databases if possible, or newest research.
            
            Strictly comply with these requirements:
            1. Output must be valid JSON object with an "articles" array.
            2. Abstract must be in Traditional Chinese (繁體中文).
            3. Ensure fields are complete and not truncated.
            
            JSON Format:
            { "articles": [{ "authors": "...", "title": "...", "source": "...", "year": "...", "abstract": "Summary in Traditional Chinese...", "doi": "..." }] }`;

            const res = await fetch('/api/gemini', {
                method: 'POST',
                body: JSON.stringify({
                    model: 'gemini-3-pro-preview',
                    prompt: prompt,
                    history: []
                })
            });

            if (!res.ok) throw new Error(res.statusText);

            const data = await res.json();
            if (!data.text) throw new Error(data.details || "No text returned from Gemini");
            const jsonStr = (data.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
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
                sourceModel: 'gemini-3-pro-preview' // Papers found by Gemini 3.0 Pro
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

            setProgress(`Fetching ${scopusCount} papers from Scopus...`);
            const scopusAction = fetchScopus(searchKeyword, scopusCount);

            setProgress(`Fetching ${geminiCount} papers from Gemini...`);
            const geminiAction = fetchGemini(searchKeyword, geminiCount);

            const [scopusResults, geminiResults] = await Promise.all([scopusAction, geminiAction]);

            // APPEND to existing results, deduplicate based on DOI or exact title
            let newTotal = 0;
            let addedCount = 0;
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

                newTotal = combined.length;
                // Immediate Save
                onAutoSave?.(combined);
                return combined;
            });

            setTimeout(() => {
                setProgress(`Added ${scopusResults.length + geminiResults.length} papers (${scopusResults.length} Scopus, ${geminiResults.length} Gemini). Total: ${newTotal} papers.`);
            }, 100);
        } catch (e) {
            console.error(e);
            setProgress('Search failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeDeeply = async () => {
        if (results.length === 0) return;
        setIsAnalyzing(true);

        const newResults = [...results];

        // Count papers that need analysis (those without methodology)
        const needsAnalysis = newResults.filter(a => !a.methodology || a.methodology === '');
        if (needsAnalysis.length === 0) {
            setProgress('All papers already analyzed!');
            setIsAnalyzing(false);
            return;
        }

        setProgress(`Starting Deep Analysis: ${needsAnalysis.length} papers to analyze (${newResults.length - needsAnalysis.length} already done)...`);

        let analyzedCount = 0;
        for (let i = 0; i < newResults.length; i++) {
            const article = newResults[i];

            // Skip already-analyzed papers (those with methodology filled)
            if (article.methodology && article.methodology !== '') {
                continue;
            }

            analyzedCount++;
            setProgress(`Analyzing paper ${analyzedCount} / ${needsAnalysis.length}: ${article.title.substring(0, 30)}...`);

            try {
                const prompt = `Analyze this paper metadata and fill in missing details with high accuracy.
                Current Metadata: ${JSON.stringify(article)}
                
                Task:
                1. Standardize "authors" (Last, F. M.).
                2. Extract/Verify "year".
                3. Estimate "page count" if missing.
                4. Extract "keywords" (if missing, generate 5 relevant ones in English, comma separated).
                5. Summarize "abstract" in Traditional Chinese (繁體中文). Do NOT truncate field content.
                6. Identify "methodology" (e.g., Survey, Experiment) in Traditional Chinese if possible or English.
                7. Ensure NO fields use "..." ellipsis. Provide full text.
                
                Return JSON ONLY:
                {
                    "authors": "...",
                    "year": "...",
                    "pages": "...",
                    "keywords": "...",
                    "abstract": "...",
                    "methodology": "..."
                }`;

                // Select analysis model based on source
                // - Gemini 3.0 Pro papers -> use Gemini 3.0 Flash
                // - Scopus/other papers -> use Gemini 2.0 Flash
                const analysisModel = article.sourceModel === 'gemini-3-pro-preview'
                    ? 'gemini-3-flash-preview'
                    : 'gemini-2.0-flash';

                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: analysisModel,
                        task: 'summary',
                        prompt: prompt,
                        history: []
                    })
                });

                const data = await res.json();
                const jsonStr = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(jsonStr);

                // Update fields
                newResults[i] = {
                    ...article,
                    authors: parsed.authors || article.authors,
                    year: parsed.year || article.year,
                    pages: (parsed.pages && parsed.pages !== 'N/A') ? parsed.pages : article.pages,
                    keywords: parsed.keywords || article.keywords,
                    abstract: parsed.abstract || article.abstract,
                    methodology: parsed.methodology || ''
                };

                setResults([...newResults]); // Live update
                onAutoSave?.([...newResults]); // Instant save per paper
            } catch (e) {
                console.error(`Analysis failed for index ${i}`, e);
            }
        }

        setIsAnalyzing(false);
        setProgress('Deep Analysis Complete.');
    };

    const exportCSV = () => {
        const headers = ['Authors', 'Title', 'Source', 'Year', 'Pages', 'DOI', 'PDF Link', 'Keywords', 'Methodology', 'Abstract'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => [
                `"${r.authors}"`,
                `"${r.title.replace(/"/g, '""')}"`,
                `"${r.source.replace(/"/g, '""')}"`,
                r.year,
                r.pages,
                r.doi,
                r.link,
                `"${r.keywords.replace(/"/g, '""')}"`,
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

            {/* Group Selector */}
            {groups.length > 0 && (
                <div className="px-6 py-3 border-b border-border/40 bg-muted/10">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Group:</span>
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
            )}

            {/* Controls */}
            <div className="p-6 border-b border-border/40 space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter research topic..."
                            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-900 border border-transparent focus:border-blue-500 rounded-lg outline-none transition-all"
                        />
                        <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Year Filter */}
                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-transparent focus-within:border-blue-500">
                        <Calendar size={14} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Year:</span>
                        <input
                            type="number"
                            value={startYear}
                            onChange={(e) => setStartYear(parseInt(e.target.value))}
                            className="w-14 bg-transparent outline-none text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground">-</span>
                        <input
                            type="number"
                            value={endYear}
                            onChange={(e) => setEndYear(parseInt(e.target.value))}
                            className="w-14 bg-transparent outline-none text-xs text-center"
                        />
                    </div>

                    {/* Customizable Counts */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Scopus:</span>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={scopusCount}
                            onChange={(e) => setScopusCount(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                            className="w-10 bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 outline-none text-xs text-center"
                        />
                        <span className="text-[10px] text-muted-foreground">Gemini:</span>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            value={geminiCount}
                            onChange={(e) => setGeminiCount(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                            className="w-10 bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 outline-none text-xs text-center"
                        />
                    </div>

                    {/* Action Buttons - Same Row */}
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !query}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 text-xs font-medium transition-colors"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : `+ Add (${scopusCount}+${geminiCount})`}
                    </button>
                    {onSave && results.length > 0 && (
                        <button
                            onClick={() => onSave(results)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Save size={12} /> Save
                        </button>
                    )}
                    {results.length > 0 && !isAnalyzing && (
                        <button
                            onClick={analyzeDeeply}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Play size={12} fill="currentColor" /> Deep Analysis
                        </button>
                    )}
                    {isAnalyzing && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 animate-pulse">
                            <Loader2 size={12} className="animate-spin" /> Analyzing...
                        </div>
                    )}
                </div>

                <div className="flex items-center">
                    <div className="text-xs text-muted-foreground font-mono">
                        {progress}
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
                        {results.map((article, index) => (
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
                                    {article.id.startsWith('gen-gemini') && (
                                        <div className="mt-2 text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 px-1 py-0.5 rounded w-fit">Gemini Generated</div>
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

                                        {/* Upload PDF Button or Status */}
                                        {uploadingPdfId === article.id ? (
                                            <Loader2 size={14} className="animate-spin text-orange-500" />
                                        ) : article.pdfUrl ? (
                                            // Check if it's a valid URL (starts with http)
                                            article.pdfUrl.startsWith('http') ? (
                                                <a
                                                    href={article.pdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                    title="Open PDF in Google Drive"
                                                >
                                                    <Download size={14} />
                                                </a>
                                            ) : (
                                                // Not a valid URL, show indicator that file is saved
                                                <div className="text-[9px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded" title={article.pdfUrl}>
                                                    ✓
                                                </div>
                                            )
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
    );
}

