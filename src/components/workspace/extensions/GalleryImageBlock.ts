import { Node, mergeAttributes } from '@tiptap/core';

export const GalleryImageBlock = Node.create({
  name: 'galleryImageBlock',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      imgUrl: { default: '' },
      title: { default: 'Untitled' },
      pageId: { default: null },
      itemId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-gallery-image-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-gallery-image-block': '',
        'data-img-url': HTMLAttributes.imgUrl,
        'data-item-id': HTMLAttributes.itemId,
        'data-page-id': HTMLAttributes.pageId,
        style:
          'display: inline-flex; align-items: center; gap: 4px; padding: 1px 2px; border-radius: 4px; cursor: pointer; vertical-align: middle;',
      }),
      [
        'img',
        {
          src: HTMLAttributes.imgUrl,
          style: 'width: 20px; height: 20px; border-radius: 3px; object-fit: cover; display: inline-block; vertical-align: middle;',
          alt: HTMLAttributes.title,
        },
      ],
      [
        'span',
        {
          style: 'color: #22d3ee; font-size: 13px; line-height: 1;',
        },
        HTMLAttributes.title || 'Untitled',
      ],
      [
        'span',
        {
          'data-remove-gallery-image': '',
          'data-item-id': HTMLAttributes.itemId,
          class: 'material-symbols-outlined',
          style:
            'font-size: 12px; cursor: pointer; border-radius: 2px; line-height: 1; color: #6b7280;',
          title: 'Remove image',
        },
        'close',
      ],
    ];
  },

  addCommands() {
    return {
      insertGalleryImage:
        (attrs: { imgUrl: string; title: string; pageId?: string; itemId?: string }) =>
        ({ chain }: any) => {
          return chain()
            .insertContent({
              type: 'galleryImageBlock',
              attrs,
            })
            .run();
        },
    } as any;
  },
});