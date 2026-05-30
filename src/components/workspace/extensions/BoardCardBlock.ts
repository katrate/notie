import { Node, mergeAttributes } from '@tiptap/core';

export const BoardCardBlock = Node.create({
  name: 'boardCardBlock',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      cardId: { default: null },
      title: { default: 'Untitled' },
      pageId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-board-card-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-board-card-block': '',
        'data-card-id': HTMLAttributes.cardId,
        'data-page-id': HTMLAttributes.pageId,
        style:
          'display: inline-flex; align-items: center; gap: 4px; padding: 1px 2px; border-radius: 4px; cursor: pointer; vertical-align: middle;',
      }),
      [
        'span',
        {
          class: 'material-symbols-outlined',
          style: 'font-size: 14px; line-height: 1; color: #a78bfa;',
        },
        'sticky_note_2',
      ],
      [
        'span',
        {
          style: 'color: #a78bfa; font-size: 13px; line-height: 1;',
        },
        HTMLAttributes.title || 'Untitled',
      ],
      [
        'span',
        {
          'data-remove-board-card': '',
          'data-card-id': HTMLAttributes.cardId,
          class: 'material-symbols-outlined',
          style:
            'font-size: 12px; cursor: pointer; border-radius: 2px; line-height: 1; color: #6b7280;',
          title: 'Remove card',
        },
        'close',
      ],
    ];
  },

  addCommands() {
    return {
      insertBoardCard:
        (attrs: { cardId: string; title: string; pageId: string }) =>
        ({ chain }: any) => {
          return chain()
            .insertContent({
              type: 'boardCardBlock',
              attrs,
            })
            .run();
        },
    } as any;
  },
});