import React, { useState, useEffect, useRef } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import katex from 'katex';

export const MathComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, getPos, editor }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [latex, setLatex] = useState(node.attrs.latex);
    const inputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLSpanElement>(null);

    // Update local state when node attributes change
    useEffect(() => {
        setLatex(node.attrs.latex);
    }, [node.attrs.latex]);

    // Handle rendering Katex
    useEffect(() => {
        if (previewRef.current && !isEditing) {
            try {
                katex.render(latex, previewRef.current, {
                    throwOnError: false,
                    displayMode: false,
                });
            } catch (e) {
                previewRef.current.innerText = (e as Error).message;
            }
        }
    }, [latex, isEditing]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLatex(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
        updateAttributes({ latex: latex });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
            updateAttributes({ latex: latex });
            editor.commands.focus();
        }
    };

    return (
        <NodeViewWrapper className="inline-block">
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={latex}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="border rounded px-1 min-w-[50px] bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
            ) : (
                <span
                    ref={previewRef}
                    onClick={() => setIsEditing(true)}
                    className={`cursor-pointer px-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-block font-medium ${selected ? 'ring-2 ring-purple-500' : ''}`}
                    title="Click to edit LaTeX"
                />
            )}
        </NodeViewWrapper>
    );
};
