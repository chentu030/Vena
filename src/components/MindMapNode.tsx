import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, Node, NodeProps } from '@xyflow/react';

// Define the data structure expected in our nodes
type NodeData = {
    label: string;
    isEditing?: boolean;
    color?: string;
    onLabelChange?: (id: string, newLabel: string) => void;
};

// React Flow's NodeProps takes the specific Node type as a generic, OR just use `NodeProps` with the data cast inside.
// Actually, `NodeProps` generic is `T extends Node`.
type CustomNode = Node<NodeData>;

export default function MindMapNode({ data, selected, id }: NodeProps<CustomNode>) {
    const [value, setValue] = useState(data.label);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state if external data changes (e.g. initial load)
    useEffect(() => {
        setValue(data.label);
    }, [data.label]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (data.isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [data.isEditing]);

    const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        setValue(evt.target.value);
    };

    const onKeyDown = (evt: React.KeyboardEvent) => {
        if (evt.key === 'Enter') {
            // Explicitly trigger save before blurring to ensure data is updated
            handleBlur();
            inputRef.current?.blur();
        }
    };

    // We need a callback to save changes. 
    // Since proper data flow uses useReactFlow().setNodes, we can do that or dispatch an event.
    // A cleaner way for custom nodes is to use the `data` object callbacks if provided,
    // or use the `useReactFlow` hook to update itself.

    // However, simpler pattern: The parent 'EditableMindMap' handles the 'isEditing' state toggling.
    // But for the *value* update, `data.label` needs to change.
    // We will fire a custom event or use a callback passed in data if possible.
    // React Flow recommends updating nodes via setNodes in the flow instance.

    // Let's assume the parent passes an `onChange` handler in data, OR we use an event bus.
    // Actually, easiest is:
    // The input is controlled. On Blur, we invoke a data callback "onLabelChange".
    const handleBlur = () => {
        // Trigger parent update
        if (data.onLabelChange && typeof data.onLabelChange === 'function') {
            data.onLabelChange(id, value);
        }
    };

    // Exit edit mode when deselected (clicked outside)
    useEffect(() => {
        if (!selected && data.isEditing) {
            if (data.onLabelChange && typeof data.onLabelChange === 'function') {
                data.onLabelChange(id, value);
            }
        }
    }, [selected]);

    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 transition-all min-w-[150px] text-center
      ${selected ? 'selected-node border-blue-500 shadow-lg' : 'border-neutral-300 dark:border-neutral-600'}
`}
            style={{
                backgroundColor: data.color || '#ffffff',
                // Force text to be black if background is light-ish (default), 
                // white if background is very dark. For now simplicity: Black Text on these cards.
                color: '#000000'
            }}
        >
            {/* 4-Way Handles - Visible circles for easy connection */}
            <Handle type="source" position={Position.Top} id="top" className="w-3 h-3 !bg-blue-400 hover:!bg-blue-600 transition" />
            <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-blue-400 hover:!bg-blue-600 transition" />
            <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 !bg-blue-400 hover:!bg-blue-600 transition" />
            <Handle type="source" position={Position.Left} id="left" className="w-3 h-3 !bg-blue-400 hover:!bg-blue-600 transition" />

            {data.isEditing ? (
                <input
                    ref={inputRef}
                    value={value}
                    onChange={onChange}
                    onBlur={handleBlur}
                    className="nodrag text-center w-full bg-transparent border-b border-blue-500 outline-none text-black font-medium"
                    onKeyDown={onKeyDown}
                />
            ) : (
                <div className="font-medium text-sm text-black pointer-events-none select-none">{data.label}</div>
            )}
        </div>
    );
}
