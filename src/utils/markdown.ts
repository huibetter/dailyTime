import { defaultSchema } from 'rehype-sanitize';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ['target'], ['rel']],
    img: [...(defaultSchema.attributes?.img ?? []), ['src'], ['alt'], ['title']],
    input: [['type'], ['checked'], ['disabled']],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data', 'asset'],
  },
} as Parameters<typeof rehypeSanitize>[0];

export async function renderMarkdown(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    // rehype-sanitize's current types expose the schema as the first plugin option.
    .use(rehypeSanitize as any, schema)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}


export function markdownFallback(markdown: string) {
  return markdown.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
