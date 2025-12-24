import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MathComponent } from './MathComponent';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        math: {
            insertMath: (latex: string) => ReturnType;
        };
    }
}

export const MathExtension = Node.create({
    name: 'math',

    group: 'inline',

    inline: true,

    selectable: true,

    atom: true,

    addAttributes() {
        return {
            latex: {
                default: 'E=mc^2',
                parseHTML: element => element.getAttribute('data-latex'),
                renderHTML: attributes => ({
                    'data-latex': attributes.latex,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="math"]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math' }), node.attrs.latex];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MathComponent);
    },

    addCommands() {
        return {
            insertMath: (latex: string) => ({ commands }: { commands: any }) => {
                return commands.insertContent({
                    type: 'math',
                    attrs: { latex },
                });
            },
        };
    },
});
