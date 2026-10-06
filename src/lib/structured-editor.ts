import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';

const ResourceImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markdownSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-markdown-src'),
        renderHTML: (attributes) =>
          attributes.markdownSrc ? { 'data-markdown-src': attributes.markdownSrc } : {},
      },
    };
  },
});

export function createStructuredEditorExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ResourceImage.configure({ inline: true, allowBase64: false }),
    Link.configure({ openOnClick: false, autolink: true }),
    Underline,
  ];
}
