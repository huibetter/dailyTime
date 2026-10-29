/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('markdown renderer', () => {
  it('renders common markdown structures', () => {
    const html = renderMarkdown('# 标题\n\n- [x] 完成\n- 普通项\n\n[链接](https://example.com)');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('href="https://example.com"');
  });

  it('renders tables, fenced code, quotes, images, and links', () => {
    const fence = String.fromCharCode(96).repeat(3);
    const html = renderMarkdown(
      '| 名称 | 值 |\n| --- | --- |\n| 项目 | DailyTime |\n\n' +
        fence +
        'js\nconst ready = true;\n' +
        fence +
        '\n\n> 引用\n\n![图](https://example.com/image.png) [链接](https://example.com)',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<img');
    expect(html).toContain('href="https://example.com"');
  });

  it('removes scripts, event handlers, and unsafe protocols', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">危险链接</a>',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });
});
