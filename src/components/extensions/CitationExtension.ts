
import { Node, mergeAttributes, InputRule, PasteRule } from '@tiptap/core';
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
            {
                tag: 'span[data-citation]',
                getAttrs: (node) => {
                    if (typeof node === 'string') return {};
                    return {
                        index: node.getAttribute('data-index'),
                        title: node.getAttribute('data-title'),
                        doi: node.getAttribute('data-doi'),
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // Output as simple text in span for HTML exports (Word/PDF via HTML)
        // This ensures [1] is visible in exports even if CSS/JS is missing.
        // We add data attributes to reconstruct it if needed.
        return ['span', mergeAttributes(HTMLAttributes, { 'data-citation': '', 'data-index': HTMLAttributes.index }), `[${HTMLAttributes.index}]`];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CitationComponent);
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\[([\d,\s]+)\]$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const index = match[1];
                    tr.replaceWith(range.from, range.to, this.type.create({ index }));
                },
            }),
        ];
    },

    addPasteRules() {
        return [
            new PasteRule({
                find: /\[([\d,\s]+)\]/g,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const index = match[1];
                    if (index) {
                        tr.replaceWith(range.from, range.to, this.type.create({ index }));
                    }
                },
            }),
        ];
    },
});
