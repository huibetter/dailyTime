/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  editorStateToMarkdown,
  editorStateToPlainText,
  editorStateToTitle,
  markdownToEditorHtml,
} from './editor-document';

describe('structured editor document helpers', () => {
  it('marks task lists for the structured editor', () => {
    const html = markdownToEditorHtml('- [ ] one\n- [x] two');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-type="taskItem"');
  });

  it('converts unsupported tables to editable text', () => {
    expect(markdownToEditorHtml('| A | B |\n| --- | --- |\n| one | two |')).toContain(
      'A | B / one | two',
    );
  });

  it('serializes core structured nodes to markdown', () => {
    const state = {
      type: 'doc' as const,
      version: 1,
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '标题' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '粗体', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' 普通' },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '完成' }] }],
            },
          ],
        },
      ],
    };
    expect(editorStateToMarkdown(state)).toContain('# 标题');
    expect(editorStateToMarkdown(state)).toContain('**粗体** 普通');
    expect(editorStateToMarkdown(state)).toContain('- [x] 完成');
    expect(editorStateToTitle(state)).toBe('标题');
    expect(editorStateToPlainText(state)).toContain('标题');
  });
});
