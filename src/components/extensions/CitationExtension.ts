
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CitationComponent } from './CitationComponent';

export const CitationExtension = Node.create({
    name: 'citation',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            index: {
                default: '?',
            },
            title: {
                default: '',
            },
            doi: {
                default: '',
            },
            abstract: {
                default: '',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'citation',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['citation', mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CitationComponent);
    },
});
