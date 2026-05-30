import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'error' | 'success' | 'tip';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    calloutBlock: {
      insertCalloutBlock: (type?: CalloutType) => ReturnType;
      setCalloutType: (type: CalloutType) => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: { default: 'info' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = (HTMLAttributes.type || 'info') as CalloutType;
    const iconMap: Record<CalloutType, string> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      success: 'check_circle',
      tip: 'lightbulb',
    };
    const colorMap: Record<CalloutType, string> = {
      info: 'rgba(59,130,246,0.12)',
      warning: 'rgba(234,179,8,0.15)',
      error: 'rgba(239,68,68,0.12)',
      success: 'rgba(34,197,94,0.12)',
      tip: 'rgba(168,85,247,0.12)',
    };
    const borderMap: Record<CalloutType, string> = {
      info: 'rgba(59,130,246,0.4)',
      warning: 'rgba(234,179,8,0.5)',
      error: 'rgba(239,68,68,0.4)',
      success: 'rgba(34,197,94,0.4)',
      tip: 'rgba(168,85,247,0.4)',
    };
    const colorMapText: Record<CalloutType, string> = {
      info: '#60a5fa',
      warning: '#eab308',
      error: '#ef4444',
      success: '#22c55e',
      tip: '#a855f7',
    };

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout-block': type,
        style: [
          `display: flex; gap: 10px; align-items: flex-start;`,
          `padding: 12px 16px; margin: 8px 0; border-radius: 8px;`,
          `background: ${colorMap[type]};`,
          `border-left: 3px solid ${borderMap[type]};`,
        ].join(' '),
      }),
      [
        'span',
        {
          class: 'material-symbols-outlined',
          style: `font-size: 20px; line-height: 1.5; flex-shrink: 0; color: ${colorMapText[type]}; user-select: none;`,
          contenteditable: 'false',
        },
        iconMap[type],
      ],
      [
        'div',
        {
          style: 'flex: 1; min-width: 0;',
          'data-callout-content': '',
        },
        0,
      ],
    ];
  },

  addCommands() {
    return {
      insertCalloutBlock:
        (type = 'info') =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { type },
              content: [
                {
                  type: 'paragraph',
                },
              ],
            })
            .run();
        },
      setCalloutType:
        (type: CalloutType) =>
        ({ chain }) => {
          return chain()
            .updateAttributes('calloutBlock', { type })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.insertCalloutBlock(),
      'Mod-Shift-C': () => this.editor.commands.insertCalloutBlock(),
    };
  },
});
