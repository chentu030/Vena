import React, { useState } from 'react';
import { Search, MessageSquare, X, ArrowRight, Globe, Check, ChevronDown, FolderPlus, Folder } from 'lucide-react';

interface SearchConfig {
    keywords: string;
    scopusCount: number;
    geminiCount: number;
    originalMessage: string;
    languages?: string[];
    dateRange?: { start: number; end: number };
    targetGroupId?: string; // 目標群組 ID
    newGroupName?: string; // 如果創建新群組
}

// 群組資料結構
interface ResearchGroup {
    id: string;
    name: string;
}

// 可選語言列表
const LANGUAGE_OPTIONS = [
    { id: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
    { id: 'zh-TW', name: '繁體中文', flag: '🇹🇼', nativeName: '繁體中文' },
    { id: 'zh-CN', name: '简体中文', flag: '🇨🇳', nativeName: '简体中文' },
    { id: 'ja', name: '日本語', flag: '🇯🇵', nativeName: '日本語' },
    { id: 'ko', name: '한국어', flag: '🇰🇷', nativeName: '한국어' },
    { id: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    { id: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { id: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { id: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
    { id: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
];

interface SearchConfirmationMessageProps {
    config: SearchConfig;
    onConfirm: (config: SearchConfig) => void;
    onCancel: (config: SearchConfig, chatOnly?: boolean) => void;
    groups?: ResearchGroup[]; // 可用的群組列表
    currentGroupId?: string | null; // 當前選中的群組
}

const SearchConfirmationMessage: React.FC<SearchConfirmationMessageProps> = ({ config, onConfirm, onCancel, groups = [], currentGroupId }) => {
    const [keywords, setKeywords] = useState(config.keywords);
    const [scopusCount, setScopusCount] = useState(config.scopusCount);
    const [geminiCount, setGeminiCount] = useState(config.geminiCount);
    const [startYear, setStartYear] = useState(2023);
    const [endYear, setEndYear] = useState(2026);
    const [isConfirmed, setIsConfirmed] = useState(false);

    // 語言選擇狀態 - 預設選擇英文
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

    // 群組選擇狀態
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(currentGroupId || null);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    // 切換語言選擇
    const toggleLanguage = (langId: string) => {
        setSelectedLanguages(prev => {
            if (prev.includes(langId)) {
                // 至少保留一個語言
                if (prev.length === 1) return prev;
                return prev.filter(l => l !== langId);
            } else {
                return [...prev, langId];
            }
        });
    };

    // 獲取選中群組的名稱
    const getSelectedGroupName = () => {
        if (isCreatingNewGroup && newGroupName) return `📁 ${newGroupName} (New)`;
        if (selectedGroupId) {
            const group = groups.find(g => g.id === selectedGroupId);
            return group ? `📁 ${group.name}` : 'Select Group';
        }
        return 'Select Target Group';
    };

    const handleConfirm = () => {
        setIsConfirmed(true);
        onConfirm({
            ...config,
            keywords,
            scopusCount,
            geminiCount,
            dateRange: { start: startYear, end: endYear },
            languages: selectedLanguages,
            targetGroupId: isCreatingNewGroup ? undefined : selectedGroupId || undefined,
            newGroupName: isCreatingNewGroup ? newGroupName : undefined
        } as any);
    };

    // 獲取選中語言的顯示文字
    const getSelectedLanguagesDisplay = () => {
        if (selectedLanguages.length === 0) return 'Select Languages';
        if (selectedLanguages.length === 1) {
            const lang = LANGUAGE_OPTIONS.find(l => l.id === selectedLanguages[0]);
            return lang ? `${lang.flag} ${lang.name}` : 'Select Languages';
        }
        const flags = selectedLanguages.map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.flag).join('');
        return `${flags} ${selectedLanguages.length} languages`;
    };

    if (isConfirmed) {
        const langNames = selectedLanguages.map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name).filter(Boolean).join(', ');
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <Search size={16} className="text-white" />
                </div>
                <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">Search Started</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Searching for "{keywords}" in {langNames}...</div>
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

                {/* Language Selection */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1 flex items-center gap-1">
                        <Globe size={12} />
                        Search Languages
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex items-center justify-between"
                        >
                            <span className="font-medium">{getSelectedLanguagesDisplay()}</span>
                            <ChevronDown size={14} className={`transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showLanguageDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                {LANGUAGE_OPTIONS.map((lang) => (
                                    <button
                                        key={lang.id}
                                        type="button"
                                        onClick={() => toggleLanguage(lang.id)}
                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors ${selectedLanguages.includes(lang.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                            }`}
                                    >
                                        <span className="text-base">{lang.flag}</span>
                                        <span className="flex-1">{lang.name}</span>
                                        {selectedLanguages.includes(lang.id) && (
                                            <Check size={14} className="text-blue-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedLanguages.length > 1 && (
                        <p className="text-[10px] text-muted-foreground ml-1">
                            💡 Keywords will be translated to each selected language for broader search
                        </p>
                    )}
                </div>

                {/* Group Selection */}
                {groups.length > 0 && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1 flex items-center gap-1">
                            <Folder size={12} />
                            Target Group
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowGroupDropdown(!showGroupDropdown);
                                    setShowLanguageDropdown(false);
                                }}
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex items-center justify-between"
                            >
                                <span className="font-medium truncate">{getSelectedGroupName()}</span>
                                <ChevronDown size={14} className={`transition-transform shrink-0 ${showGroupDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showGroupDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Existing Groups */}
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedGroupId(group.id);
                                                setIsCreatingNewGroup(false);
                                                setShowGroupDropdown(false);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors ${selectedGroupId === group.id && !isCreatingNewGroup ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <Folder size={14} className="text-blue-600 shrink-0" />
                                            <span className="flex-1 truncate">{group.name}</span>
                                            {selectedGroupId === group.id && !isCreatingNewGroup && (
                                                <Check size={14} className="text-blue-600 shrink-0" />
                                            )}
                                        </button>
                                    ))}

                                    {/* Create New Group Option */}
                                    <div className="border-t border-border">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingNewGroup(true);
                                                setSelectedGroupId(null);
                                                setShowGroupDropdown(false);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors text-green-600 dark:text-green-400 ${isCreatingNewGroup ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                                        >
                                            <FolderPlus size={14} className="shrink-0" />
                                            <span className="flex-1">Create New Group...</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* New Group Name Input */}
                        {isCreatingNewGroup && (
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Enter new group name..."
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-green-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all mt-1"
                                autoFocus
                            />
                        )}
                    </div>
                )}

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
