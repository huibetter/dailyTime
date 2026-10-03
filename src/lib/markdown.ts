import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'hr',
  'img',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'ul',
];
const ALLOWED_ATTR = [
  'alt',
  'class',
  'checked',
  'disabled',
  'href',
  'rel',
  'src',
  'target',
  'type',
];

export function renderMarkdown(markdown: string): string {
  const parsed = marked.parse(markdown || '', {
    gfm: true,
    breaks: true,
  });
  if (typeof parsed !== 'string') return '';
  if (typeof window === 'undefined') return parsed;
  return DOMPurify.sanitize(parsed, {
    ALLOWED_ATTR,
    ALLOWED_TAGS,
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
