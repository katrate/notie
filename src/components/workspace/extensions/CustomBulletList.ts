import BulletList from '@tiptap/extension-bullet-list';

export const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      listStyleType: {
        default: 'disc',
        parseHTML: element => element.style.listStyleType || 'disc',
        renderHTML: attributes => {
          if (!attributes.listStyleType) {
            return {};
          }
          return {
            style: `list-style-type: ${attributes.listStyleType}`,
          };
        },
      },
    };
  },
});
