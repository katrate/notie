import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    contentBlock: {
      insertContentBlock: () => ReturnType;
    };
  }
}

export const ContentBlock = Node.create({
  name: 'contentBlock',
  group: 'block',
  content: 'block*',
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-content-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-block': '',
        style:
          'border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 12px 16px; margin: 8px 0; background: rgba(255,255,255,0.03);',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertContentBlock:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [
                {
                  type: 'paragraph',
                },
              ],
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.insertContentBlock(),
      'Mod-Shift-B': () => this.editor.commands.insertContentBlock(),
    };
  },
});
