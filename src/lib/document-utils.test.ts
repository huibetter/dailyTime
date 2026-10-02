import { describe, expect, it } from 'vitest';
import {
  documentMarkdown,
  documentTitle,
  firstHeading,
  normalizeDocument,
  safeFileName,
} from './document-utils';

describe('document utilities', () => {
  it('extracts a clean first heading', () => {
    expect(firstHeading('# [项目](https://example.com) **进展**')).toBe('项目 进展');
  });

  it('normalizes legacy document fields', () => {
    const document = normalizeDocument({ id: 1, project: 'p-1', content: '# 会议记录' });
    expect(document.title).toBe('会议记录');
    expect(document.tags).toEqual([]);
    expect(document.status).toBe('未开始');
  });

  it('exports document metadata and sanitizes filenames', () => {
    const document = normalizeDocument({
      id: 'd-1',
      project: 'p-1',
      content: '# 会议记录\n\n正文',
      planned: '2026-10-03',
      plannedTime: '09:05',
      tags: ['计划'],
    });
    expect(documentTitle(document)).toBe('会议记录');
    expect(documentMarkdown(document, '产品')).toContain('> 标签：计划');
    expect(safeFileName('产品/会议')).toBe('产品-会议');
  });
});
