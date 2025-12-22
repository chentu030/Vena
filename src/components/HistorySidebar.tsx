import React, { useState } from 'react';
import { X, FileText, Map as MapIcon, Trash2, Clock, Save, MessageSquare, Pencil, Plus } from 'lucide-react';

interface HistoryItem {
    id: string;
    title: string;
    date: string;
}

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    savedDrafts: HistoryItem[];
    savedMaps: HistoryItem[];
    savedChats?: HistoryItem[];
    onLoadDraft: (id: string) => void;
    onLoadMap: (id: string) => void;
    onLoadChats?: (id: string) => void;
    onDeleteDraft: (id: string) => void;
    onDeleteMap: (id: string) => void;
    onDeleteChats?: (id: string) => void;
    onRename: (type: 'draft' | 'map' | 'chat', id: string, newTitle: string) => void;
    onNewDraft: () => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    isOpen,
    onClose,
    savedDrafts,
    savedMaps,
    savedChats,
    onLoadDraft,
    onLoadMap,
    onLoadChats,
    onDeleteDraft,
    onDeleteMap,
    onDeleteChats
}) => {
    const [activeTab, setActiveTab] = useState<'drafts' | 'maps' | 'chats'>('drafts');

    return (
        <div
            className={`fixed inset-y-0 right-0 w-80 bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-2xl z-[60] transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
            {/* Header */}
            <div className="h-16 px-6 border-b border-border/50 flex items-center justify-between shrink-0">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Clock size={18} className="text-muted-foreground" />
                    History
                </h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div className="p-4 grid grid-cols-3 gap-2 shrink-0">
                <button
                    onClick={() => setActiveTab('drafts')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'drafts' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'}`}
                >
                    <FileText size={14} /> Drafts
                </button>
                <button
                    onClick={() => setActiveTab('maps')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'maps' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'}`}
                >
                    <MapIcon size={14} /> Maps
                </button>
                <button
                    onClick={() => setActiveTab('chats')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'chats' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'}`}
                >
                    <MessageSquare size={14} /> Chats
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                {activeTab === 'drafts' && (
                    savedDrafts.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">No saved drafts</div>
                    ) : (
                        savedDrafts.map(item => (
                            <div key={item.id} className="group relative bg-white dark:bg-neutral-900 border border-border/50 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => onLoadDraft(item.id)}>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-sm line-clamp-2 pr-6">{item.title || 'Untitled Draft'}</h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteDraft(item.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all absolute top-2 right-2"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</span>
                            </div>
                        ))
                    )
                )}

                {activeTab === 'maps' && (
                    savedMaps.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">No saved maps</div>
                    ) : (
                        savedMaps.map(item => (
                            <div key={item.id} className="group relative bg-white dark:bg-neutral-900 border border-border/50 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => onLoadMap(item.id)}>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-sm line-clamp-2 pr-6">{item.title || 'Untitled Map'}</h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteMap(item.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all absolute top-2 right-2"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</span>
                            </div>
                        ))
                    )
                )}

                {activeTab === 'chats' && (
                    savedChats?.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">No saved chats</div>
                    ) : (
                        savedChats?.map(item => (
                            <div key={item.id} className="group relative bg-white dark:bg-neutral-900 border border-border/50 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => onLoadChats && onLoadChats(item.id)}>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-sm line-clamp-2 pr-6">{item.title || 'Chat History'}</h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteChats && onDeleteChats(item.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all absolute top-2 right-2"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString()}</span>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

export default HistorySidebar;
