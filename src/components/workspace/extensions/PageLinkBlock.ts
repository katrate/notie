import { Node, mergeAttributes } from '@tiptap/core';

export const PageLinkBlock = Node.create({
  name: 'pageLinkBlock',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: { default: null },
      pageTitle: {
        default: 'Untitled',
        parseHTML: el => el.getAttribute('data-page-title') || 'Untitled',
      },
      pageIcon: {
        default: 'description',
        parseHTML: el => el.getAttribute('data-page-icon') || 'description',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-page-link-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-page-link-block': '',
        'data-page-id': HTMLAttributes.pageId,
        'data-page-title': HTMLAttributes.pageTitle || 'Untitled',
        'data-page-icon': HTMLAttributes.pageIcon || 'description',
        href: '#',
        style:
          'color: #98cbff; text-decoration: none; cursor: pointer; border-bottom: 1px dashed rgba(152,203,255,0.3); display: inline-flex; align-items: center; gap: 4px; padding: 0 2px; position: relative;',
      }),
      [
        'span',
        {
          class: 'material-symbols-outlined',
          style: 'font-size: 14px; line-height: 1;',
        },
        HTMLAttributes.pageIcon || 'description',
      ],
      HTMLAttributes.pageTitle || 'Untitled',
      [
        'span',
        {
          'data-remove-link': '',
          'data-page-id': HTMLAttributes.pageId,
          class: 'material-symbols-outlined page-link-close-btn',
          style:
            'font-size: 12px; cursor: pointer; border-radius: 2px; line-height: 1;',
          title: 'Remove link',
        },
        'close',
      ],
    ];
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs: { pageId: string; pageTitle: string; pageIcon: string }) =>
        ({ chain }: any) => {
          return chain()
            .insertContent({
              type: 'pageLinkBlock',
              attrs,
            })
            .run();
        },
    } as any;
  },
});
