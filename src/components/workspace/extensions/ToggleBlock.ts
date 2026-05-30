import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      insertToggleBlock: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'toggleSummary block*',
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'details[data-toggle-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-block': '',
        open: '',
        style: [
          'margin: 8px 0;',
          'border-radius: 8px;',
          'overflow: hidden;',
          'border: 1px solid rgba(255,255,255,0.08);',
          'background: rgba(255,255,255,0.02);',
        ].join(' '),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertToggleBlock:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [
                {
                  type: 'toggleSummary',
                  content: [
                    {
                      type: 'text',
                      text: 'Toggle',
                    },
                  ],
                },
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
      'Mod-Shift-t': () => this.editor.commands.insertToggleBlock(),
      'Mod-Shift-T': () => this.editor.commands.insertToggleBlock(),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleSummary: {
      insertToggleSummary: () => ReturnType;
    };
  }
}

export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  group: 'block',
  content: 'inline*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'summary[data-toggle-summary]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'summary',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-summary': '',
        style: [
          'padding: 8px 12px;',
          'padding-left: 32px;',
          'cursor: pointer;',
          'font-weight: 500;',
          'border-radius: 8px;',
          'position: relative;',
          'user-select: none;',
          'background: rgba(255,255,255,0.03);',
          'transition: background 0.15s ease;',
          'list-style: none;',
        ].join(' '),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertToggleSummary:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [
                {
                  type: 'text',
                  text: 'Toggle',
                },
              ],
            })
            .run();
        },
    };
  },
});
