import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Search, MessageSquare, X, ArrowRight, Globe, Check, ChevronDown, FolderPlus, Folder } from 'lucide-react';

interface SearchConfig {
    keywords: string;
    scopusCount: number;
    geminiCount: number;
    originalMessage: string;
    languages?: string[];
    dateRange?: { start: number; end: number };
    targetGroupIds?: string[]; // 目標群組 IDs (多選)
    newGroupName?: string; // 如果創建新群組
}

// 群組資料結構
interface ResearchGroup {
    id: string;
    name: string;
}

// 可選語言列表
const LANGUAGE_OPTIONS = [
    { id: 'en', name: 'English', flag: 'US', nativeName: 'English' }, // Removed emoji flags, will use Lucide icons maybe or just text/svg later
    { id: 'zh-TW', name: '繁體中文', flag: 'TW', nativeName: '繁體中文' },
    { id: 'zh-CN', name: '简体中文', flag: 'CN', nativeName: '简体中文' },
    { id: 'ja', name: '日本語', flag: 'JP', nativeName: '日本語' },
    { id: 'ko', name: '한국어', flag: 'KR', nativeName: '한국어' },
    { id: 'de', name: 'German', flag: 'DE', nativeName: 'Deutsch' },
    { id: 'fr', name: 'French', flag: 'FR', nativeName: 'Français' },
    { id: 'es', name: 'Spanish', flag: 'ES', nativeName: 'Español' },
    { id: 'pt', name: 'Portuguese', flag: 'PT', nativeName: 'Português' },
    { id: 'ru', name: 'Russian', flag: 'RU', nativeName: 'Русский' },
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
    const [startYear, setStartYear] = useState(config.dateRange?.start || 2023);
    const [endYear, setEndYear] = useState(config.dateRange?.end || 2026);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const { t } = useLanguage();

    // 語言選擇狀態 - 預設選擇英文 或 Config 中的語言
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(config.languages || ['en']);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

    // 群組選擇狀態 - 改為多選
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(currentGroupId ? [currentGroupId] : []);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    // 額外指示給 Gemini
    const [additionalInstructions, setAdditionalInstructions] = useState((config as any).additionalInstructions || '');
    const [showAdvanced, setShowAdvanced] = useState(!!((config as any).additionalInstructions));

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
    const getSelectedGroupsDisplay = () => {
        if (isCreatingNewGroup && newGroupName) return `${newGroupName} (New)`;
        if (selectedGroupIds.length > 0) {
            if (selectedGroupIds.length === 1) {
                const group = groups.find(g => g.id === selectedGroupIds[0]);
                return group ? group.name : t('search.groups');
            }
            return `${selectedGroupIds.length} ${t('research.batch.selected')}`;
        }
        return t('search.groups');
    };

    const toggleGroupSelection = (groupId: string) => {
        setSelectedGroupIds(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
        setIsCreatingNewGroup(false);
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
            targetGroupIds: isCreatingNewGroup ? undefined : (selectedGroupIds.length > 0 ? selectedGroupIds : undefined),
            newGroupName: isCreatingNewGroup ? newGroupName : undefined,
            additionalInstructions: additionalInstructions.trim() || undefined
        } as any);
    };

    // 獲取選中語言的顯示文字
    const getSelectedLanguagesDisplay = () => {
        if (selectedLanguages.length === 0) return 'Select Languages';
        if (selectedLanguages.length === 1) {
            const lang = LANGUAGE_OPTIONS.find(l => l.id === selectedLanguages[0]);
            return lang ? `${lang.flag} ${lang.name}` : t('search.languages');
        }
        // Use text flags or just count
        return `${selectedLanguages.length} Languages`; // Can be improved later if needed
    };

    if (isConfirmed) {
        const langNames = selectedLanguages.map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name).filter(Boolean).join(', ');
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <Search size={16} className="text-white" />
                </div>
                <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">{t('search.started')}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">{t('search.searching', { keywords, languages: langNames })}</div>
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
                    <h3 className="font-semibold text-sm text-foreground">{t('search.title')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('search.subtitle')}</p>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {/* Keywords Input */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">{t('search.keywords')}</label>
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
                        <label className="text-xs font-medium text-muted-foreground ml-1">{t('search.scopusCount')}</label>
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
                        <label className="text-xs font-medium text-muted-foreground ml-1">{t('search.geminiCount')}</label>
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
                        <label className="text-xs font-medium text-muted-foreground ml-1">{t('search.startYear')}</label>
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
                        <label className="text-xs font-medium text-muted-foreground ml-1">{t('search.endYear')}</label>
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
                        {t('search.languages')}
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
                                        <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-muted-foreground">{lang.flag}</span>
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
                            💡 {t('search.languageWarning')}
                        </p>
                    )}
                </div>

                {/* Group Selection */}
                {groups.length > 0 && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1 flex items-center gap-1">
                            <Folder size={12} />
                            {t('search.groups')}
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
                                <span className="font-medium truncate flex items-center gap-2">
                                    <Folder size={14} className="text-blue-500" />
                                    {getSelectedGroupsDisplay()}
                                </span>
                                <ChevronDown size={14} className={`transition-transform shrink-0 ${showGroupDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showGroupDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Existing Groups */}
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => toggleGroupSelection(group.id)}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors ${selectedGroupIds.includes(group.id) && !isCreatingNewGroup ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedGroupIds.includes(group.id) ? 'bg-blue-500 border-blue-500' : 'border-neutral-400'}`}>
                                                {selectedGroupIds.includes(group.id) && <Check size={10} className="text-white" />}
                                            </div>
                                            <Folder size={14} className="text-blue-600 shrink-0" />
                                            <span className="flex-1 truncate">{group.name}</span>
                                        </button>
                                    ))}

                                    {/* Create New Group Option */}
                                    <div className="border-t border-border">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingNewGroup(true);
                                                setSelectedGroupIds([]);
                                                setShowGroupDropdown(false);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors text-green-600 dark:text-green-400 ${isCreatingNewGroup ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                                        >
                                            <FolderPlus size={14} className="shrink-0" />
                                            <span className="flex-1">{t('search.newGroup')}</span>
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
                                placeholder={t('search.enterGroupName')}
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-green-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all mt-1"
                                autoFocus
                            />
                        )}
                    </div>
                )}

                {/* Additional Instructions (Advanced) */}
                <div className="space-y-1.5">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs font-medium text-muted-foreground ml-1 flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        {t('search.additionalInstructions')}
                    </button>

                    {showAdvanced && (
                        <textarea
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            placeholder={t('search.instructionPlaceholder')}
                            className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[60px] resize-none"
                            rows={2}
                        />
                    )}
                </div>

                {/* Original Request Preview */}
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-xs text-muted-foreground border border-border/50">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{t('search.originalRequest')}</span> "{config.originalMessage}"
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Search size={16} /> {t('search.start')}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onCancel(config, true)}
                            className="py-2 bg-white dark:bg-neutral-800 border border-border hover:bg-neutral-50 dark:hover:bg-neutral-700 text-foreground rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={16} /> {t('search.chatOnly')}
                        </button>
                        <button
                            onClick={() => onCancel(config, false)}
                            className="py-2 bg-white dark:bg-neutral-800 border border-border hover:bg-neutral-50 dark:hover:bg-neutral-700 text-muted-foreground hover:text-red-500 rounded-lg text-sm font-medium transition-colors"
                        >
                            {t('search.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchConfirmationMessage;
