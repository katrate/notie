import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineSpacing: {
      setLineSpacing: (spacing: string) => ReturnType;
      unsetLineSpacing: () => ReturnType;
    };
  }
}

export const LineSpacing = Extension.create({
  name: 'lineSpacing',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem'],
      defaultSpacing: '1.5',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing: (spacing: string) => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const { from, to } = selection;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              lineHeight: spacing,
            });
          }
        });

        if (dispatch) {
          dispatch(tr);
        }
        return true;
      },
      unsetLineSpacing: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const { from, to } = selection;

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              lineHeight: null,
            });
          }
        });

        if (dispatch) {
          dispatch(tr);
        }
        return true;
      },
    };
  },
});
