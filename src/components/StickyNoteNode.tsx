import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, Node, NodeProps, NodeResizer } from '@xyflow/react';

type NodeData = {
    label: string;
    isEditing?: boolean;
    color?: string;
    onLabelChange?: (id: string, newLabel: string) => void;
};

type CustomNode = Node<NodeData>;

export default function StickyNoteNode({ data, selected, id }: NodeProps<CustomNode>) {
    const [value, setValue] = useState(data.label);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync internal state
    useEffect(() => {
        setValue(data.label);
    }, [data.label]);

    // Focus input when editing
    useEffect(() => {
        if (data.isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [data.isEditing]);

    const onChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(evt.target.value);
    };

    const handleBlur = () => {
        if (data.onLabelChange && typeof data.onLabelChange === 'function') {
            data.onLabelChange(id, value);
        }
    };

    return (
        <div
            className={`relative w-full h-full p-4 shadow-xl rounded-sm transition-all flex flex-col items-center justify-center group
            ${selected ? 'ring-2 ring-blue-500/50' : 'border border-transparent'}
            `}
            style={{
                backgroundColor: data.color || '#fef3c7', // Default yellow-100
                color: '#1f2937', // gray-800
                transform: 'rotate(-1deg)', // Slight rotation for "sticky" feel
                boxShadow: '2px 4px 6px rgba(0,0,0,0.1)'
            }}
        >
            <NodeResizer
                isVisible={selected}
                minWidth={100}
                minHeight={100}
                lineStyle={{ border: '1px solid #3b82f6' }}
                handleStyle={{ width: 8, height: 8 }}
            />

            {/* Handles for connections - Visible on hover/select */}
            {/* Added IDs to ensure all handles are distinct and uniquely addressable */}
            <Handle type="source" position={Position.Top} id="top" className="w-3 h-3 !bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 !bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Left} id="left" className="w-3 h-3 !bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />

            {data.isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onBlur={handleBlur}
                    className="nodrag w-full h-full bg-transparent border-none outline-none resize-none text-center font-handwriting text-lg leading-relaxed p-2"
                    style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}
                    placeholder="Write something..."
                />
            ) : (
                <div
                    className="w-full h-full overflow-hidden text-center whitespace-pre-wrap font-handwriting text-lg leading-relaxed pointer-events-none select-none flex items-center justify-center p-2"
                    style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}
                >
                    {data.label || "Empty Note"}
                </div>
            )}
        </div>
    );
}
