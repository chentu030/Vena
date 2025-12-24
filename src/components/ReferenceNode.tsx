import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, Node, NodeProps, NodeResizer } from '@xyflow/react';
import { BookOpen, Database, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

// Define the data structure expected in our nodes
type NodeData = {
    label: string;
    isEditing?: boolean;
    color?: string;
    onLabelChange?: (id: string, newLabel: string, keepEditing?: boolean) => void;
    referenceType?: 'paper' | 'database';
    availableGroups?: any[]; // Passed from parent
    selectedGroupId?: string;
    selectedPaperId?: string;
    paperDoi?: string;
    paperAbstract?: string;
    isCompact?: boolean; // Toggle for compact/full view
};

type CustomNode = Node<NodeData>;

export default function ReferenceNode({ data, selected, id }: NodeProps<CustomNode>) {
    const [value, setValue] = useState(data.label);
    const [mode, setMode] = useState<'paper' | 'database'>(data.referenceType || 'paper');
    const [selectedGroup, setSelectedGroup] = useState<string>(data.selectedGroupId || '');
    const [selectedPaper, setSelectedPaper] = useState<string>(data.selectedPaperId || '');
    const [isCompact, setIsCompact] = useState<boolean>(data.isCompact ?? false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state if external data changes
    useEffect(() => {
        setValue(data.label);
        if (data.referenceType) setMode(data.referenceType);
        if (data.selectedGroupId) setSelectedGroup(data.selectedGroupId);
        if (data.selectedPaperId) setSelectedPaper(data.selectedPaperId);
        if (data.isCompact !== undefined) setIsCompact(data.isCompact);
    }, [data.label, data.referenceType, data.selectedGroupId, data.selectedPaperId, data.isCompact]);

    // Exit edit mode when node is deselected (clicked outside)
    useEffect(() => {
        if (!selected && data.isEditing) {
            // Trigger exit editing
            if (data.onLabelChange) {
                data.onLabelChange(id, data.label, false);
            }
        }
    }, [selected]);

    // Toggle compact/full view
    const toggleCompactView = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newCompact = !isCompact;
        setIsCompact(newCompact);
        updateNodeData({ isCompact: newCompact }, false);
    };

    // Handle update to parent
    const updateNodeData = (updates: Partial<NodeData>, keepEditing: boolean = true) => {
        // Safe update of the data object
        Object.entries(updates).forEach(([key, val]) => {
            (data as any)[key] = val;
        });

        if (data.onLabelChange) {
            data.onLabelChange(id, updates.label || data.label, keepEditing);
        }
    };

    const handleModeChange = (newMode: 'paper' | 'database') => {
        setMode(newMode);
        updateNodeData({ referenceType: newMode }, true);
        // Reset selections
        setSelectedGroup('');
        setSelectedPaper('');
    };

    const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const gId = e.target.value;
        setSelectedGroup(gId);

        const groupUpdates: Partial<NodeData> = { selectedGroupId: gId };

        if (mode === 'database') {
            const group = data.availableGroups?.find(g => String(g.id) === String(gId));
            if (group) {
                const newLabel = `[Database] ${group.name}`;
                setValue(newLabel);
                groupUpdates.label = newLabel;
            }
        }
        updateNodeData(groupUpdates, true); // Keep editing
    };

    const handlePaperChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const pId = e.target.value;
        setSelectedPaper(pId);

        // Find paper in the CURRENTLY SELECTED GROUP
        const currentGroup = data.availableGroups?.find(g => String(g.id) === String(selectedGroup));
        const paper = currentGroup?.papers?.find((p: any) => String(p.id) === String(pId));

        if (paper) {
            const newLabel = paper.title;
            setValue(newLabel);
            // Finish editing since paper is selected
            updateNodeData({
                selectedPaperId: pId,
                label: newLabel,
                paperDoi: paper.doi,
                paperAbstract: paper.abstract
            }, false);
        } else {
            updateNodeData({ selectedPaperId: pId }, true);
        }
    };

    // Derived lists
    const currentGroup = data.availableGroups?.find(g => String(g.id) === String(selectedGroup));
    const papers = currentGroup?.papers || [];

    return (
        <div
            className={`group relative transition-all duration-300 ${selected ? 'selected-node ring-2 ring-purple-500 ring-offset-4 shadow-2xl' : 'hover:shadow-lg'}`}
            style={{ minWidth: 280, minHeight: isCompact ? 80 : 120 }}
        >
            <NodeResizer
                minWidth={280}
                minHeight={isCompact ? 80 : 120}
                isVisible={selected}
                lineClassName="border-purple-400"
                handleClassName="h-3 w-3 bg-white border-2 border-purple-500 rounded"
            />
            {/* Target Handles - Top and Left */}
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
                style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
                id="left"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
            />

            <div
                className={`w-full h-full min-h-[inherit] p-4 rounded-xl shadow-sm border-2 overflow-hidden bg-white dark:bg-neutral-800 transition-colors ${selected ? 'border-purple-500' : 'border-purple-200 dark:border-purple-900 group-hover:border-purple-300'}`}
                style={{ backgroundColor: data.color || '#faf5ff' }}
            >
                {data.isEditing ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2 border-purple-100 dark:border-purple-900/50">
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                                {mode === 'paper' ? <BookOpen size={16} /> : <Database size={16} />}
                                <span className="text-[10px] font-bold uppercase tracking-wider">{mode}</span>
                            </div>
                            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-md">
                                <button
                                    onClick={() => handleModeChange('database')}
                                    className={`p-1 rounded ${mode === 'database' ? 'bg-white dark:bg-neutral-800 shadow-sm text-purple-600' : 'text-neutral-400'}`}
                                >
                                    <Database size={14} />
                                </button>
                                <button
                                    onClick={() => handleModeChange('paper')}
                                    className={`p-1 rounded ${mode === 'paper' ? 'bg-white dark:bg-neutral-800 shadow-sm text-purple-600' : 'text-neutral-400'}`}
                                >
                                    <BookOpen size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Group Selection */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground uppercase font-semibold">Source Group</label>
                            <div className="relative">
                                <select
                                    value={selectedGroup}
                                    onChange={handleGroupChange}
                                    className="w-full bg-white dark:bg-neutral-900 border border-purple-100 dark:border-purple-800 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none focus:ring-1 focus:ring-purple-400 appearance-none"
                                >
                                    <option value="">Select Group...</option>
                                    {data.availableGroups?.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Paper Selection (if in Paper mode) */}
                        {mode === 'paper' && (
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Select Paper</label>
                                <div className="relative">
                                    <select
                                        value={selectedPaper}
                                        onChange={handlePaperChange}
                                        disabled={!selectedGroup}
                                        className="w-full bg-white dark:bg-neutral-900 border border-purple-100 dark:border-purple-800 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none focus:ring-1 focus:ring-purple-400 appearance-none disabled:opacity-50"
                                    >
                                        <option value="">{selectedGroup ? 'Select Paper...' : 'First select group'}</option>
                                        {papers.map((p: any) => (
                                            <option key={p.id} value={p.id}>{(p.title || 'Untitled').substring(0, 50)}...</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        <div className="mt-2 text-[9px] text-neutral-400 italic text-center">
                            Double click to save / exit editing
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between mb-1 border-b border-purple-100 dark:border-purple-900/30 pb-2">
                            <div className="flex items-center gap-2">
                                {mode === 'paper' ? (
                                    <BookOpen size={16} className="text-purple-600 dark:text-purple-400" />
                                ) : (
                                    <Database size={16} className="text-purple-600 dark:text-purple-400" />
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                    {mode}
                                </span>
                            </div>
                            {/* Compact/Full Toggle Button */}
                            {mode === 'paper' && (data.paperDoi || data.paperAbstract) && (
                                <button
                                    onClick={toggleCompactView}
                                    className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500 transition-colors"
                                    title={isCompact ? 'Show full details' : 'Show title only'}
                                >
                                    {isCompact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                </button>
                            )}
                        </div>
                        <div className="text-sm font-semibold leading-relaxed text-neutral-800 dark:text-neutral-100">
                            {data.label}
                        </div>

                        {/* Display DOI and Abstract if available (Paper Mode) - Hide if compact */}
                        {mode === 'paper' && !isCompact && (
                            <div className="mt-2 pt-2 border-t border-purple-100 dark:border-purple-900/20 flex flex-col gap-2">
                                {data.paperDoi && (
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-purple-400">DOI</span>
                                        <a
                                            href={`https://doi.org/${data.paperDoi}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-blue-500 hover:underline truncate"
                                        >
                                            {data.paperDoi}
                                        </a>
                                    </div>
                                )}
                                {data.paperAbstract && (
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-purple-400">AI Summary</span>
                                        <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-4 leading-relaxed italic">
                                            {data.paperAbstract}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Source Handles - Bottom and Right */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
                style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
                id="right"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
        </div>
    );
}
