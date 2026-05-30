import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    caseConverter: {
      toggleCase: () => ReturnType;
    };
  }
}

export const CaseConverter = Extension.create({
  name: 'caseConverter',

  addCommands() {
    return {
      toggleCase: () => ({ state, dispatch }) => {
        const { selection, doc } = state;
        if (selection.empty) {
          return false;
        }

        const text = doc.textBetween(selection.from, selection.to, '\n');
        const isUppercase = text === text.toUpperCase() && text !== text.toLowerCase();
        const newText = isUppercase ? text.toLowerCase() : text.toUpperCase();

        if (dispatch) {
          const tr = state.tr.insertText(newText, selection.from, selection.to);
          dispatch(tr);
        }
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-u': () => this.editor.commands.toggleCase(),
    };
  },
});
