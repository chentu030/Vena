import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, Node, NodeProps, NodeResizer } from '@xyflow/react';

type NodeData = {
    label: string;
    isEditing?: boolean;
    color?: string;
    onLabelChange?: (id: string, newLabel: string) => void;
};

type CustomNode = Node<NodeData>;

export default function DescriptionNode({ data, selected, id }: NodeProps<CustomNode>) {
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
            className={`relative min-w-[150px] min-h-[50px] p-2 transition-all group
            ${selected ? 'border-2 border-blue-500/50 rounded-md bg-white/50 dark:bg-black/20' : 'border border-transparent'}
            `}
            style={{
                color: data.color || '#6b7280', // Default muted gray
            }}
        >
            <NodeResizer
                isVisible={selected}
                minWidth={100}
                minHeight={30}
                lineStyle={{ border: '1px solid #3b82f6' }}
                handleStyle={{ width: 6, height: 6 }}
            />

            {/* Subtle handles */}
            <Handle type="source" position={Position.Top} id="top" className="w-2 h-2 !bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 !bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Handle type="source" position={Position.Left} id="left" className="w-2 h-2 !bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />

            {data.isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onBlur={handleBlur}
                    className="nodrag w-full h-full bg-transparent border-none outline-none resize-none text-base leading-relaxed p-1"
                    placeholder="Add description..."
                />
            ) : (
                <div
                    className="w-full h-full overflow-hidden text-base leading-relaxed pointer-events-none select-none p-1 whitespace-pre-wrap"
                >
                    {data.label || "Description text"}
                </div>
            )}
        </div>
    );
}
