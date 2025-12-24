import React, { useState } from 'react';
import { X, FileText, Map as MapIcon, Trash2, Clock, Save, MessageSquare, Pencil, Plus, Search } from 'lucide-react';

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
    onRename: (type: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', id: string, newTitle: string) => void;
    onNewDraft: () => void;
    savedManuscripts?: HistoryItem[];
    onLoadManuscript?: (id: string) => void;
    onDeleteManuscript?: (id: string) => void;
    onNewManuscript?: () => void;
    savedResearch?: HistoryItem[];
    onLoadResearch?: (id: string) => void;
    onDeleteResearch?: (id: string) => void;
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
    onDeleteChats,
    onRename,
    onNewDraft,
    savedManuscripts = [],
    onLoadManuscript,
    onDeleteManuscript,
    onNewManuscript,
    savedResearch = [],
    onLoadResearch,
    onDeleteResearch
}) => {
    const [activeTab, setActiveTab] = useState<'drafts' | 'maps' | 'chats' | 'manuscripts' | 'research'>('manuscripts');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const startEditing = (e: React.MouseEvent, item: HistoryItem) => {
        e.stopPropagation();
        setEditingId(item.id);
        setEditTitle(item.title);
    };

    const saveEdit = (e: React.MouseEvent | React.KeyboardEvent, type: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', id: string) => {
        e.stopPropagation();
        if (editTitle.trim()) {
            onRename(type, id, editTitle.trim());
        }
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', id: string) => {
        if (e.key === 'Enter') {
            saveEdit(e, type, id);
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    const renderItem = (item: HistoryItem, type: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', onLoad: (id: string) => void, onDelete: (id: string) => void) => {
        const isEditing = editingId === item.id;

        return (
            <div key={item.id} className="group relative bg-white dark:bg-neutral-900 border border-border/50 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer" onClick={() => !isEditing && onLoad(item.id)}>
                <div className="flex justify-between items-start mb-1">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, type, item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-transparent border-b border-blue-500 outline-none text-sm font-medium mr-2"
                            autoFocus
                            onBlur={() => setEditingId(null)}
                        />
                    ) : (
                        <h3 className="font-medium text-sm line-clamp-2 pr-16">{item.title || `Untitled ${type}`}</h3>
                    )}

                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditing && (
                            <button
                                onClick={(e) => startEditing(e, item)}
                                className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-muted-foreground">
                        {item.date ? new Date(item.date).toLocaleDateString() : 'Unknown date'}
                    </span>
                    {(item as any).createdAt && (
                        <span className="text-[10px] text-muted-foreground/50" title="Created At">
                            {new Date((item as any).createdAt).toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>
        );
    };

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
            <div className="p-4 grid grid-cols-2 gap-1 shrink-0">

                <button
                    onClick={() => setActiveTab('drafts')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'drafts' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'}`}
                    title="Drafts"
                >
                    <FileText size={14} /> Draft
                </button>

                <button
                    onClick={() => setActiveTab('chats')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'chats' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground hover:text-foreground'}`}
                    title="Chats"
                >
                    <MessageSquare size={14} /> Chat
                </button>
            </div>

            {/* New Button Area */}
            {activeTab === 'drafts' && (
                <div className="px-4 pb-2">
                    <button onClick={onNewDraft} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">
                        <Plus size={14} /> New Draft
                    </button>
                </div>
            )}


            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">


                {activeTab === 'drafts' && (
                    savedDrafts.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">No saved drafts</div>
                    ) : (
                        savedDrafts.map(item => renderItem(item, 'draft', onLoadDraft, onDeleteDraft))
                    )
                )}



                {activeTab === 'chats' && (
                    !savedChats || savedChats.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">No saved chats</div>
                    ) : (
                        savedChats.map(item => renderItem(item, 'chat', onLoadChats!, onDeleteChats!))
                    )
                )}


            </div>
        </div>
    );
};

export default HistorySidebar;
