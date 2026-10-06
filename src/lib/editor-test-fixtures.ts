import type { RuntimeDocument, RuntimeProject, RuntimeState } from '../data/runtime-storage';

export const EDITOR_TEST_PROJECT_ID = 'dailytime-editor-rebuild-test';
export const EDITOR_FORMAT_DOCUMENT_ID = 'dailytime-editor-format-test';
export const EDITOR_PERFORMANCE_DOCUMENT_ID = 'dailytime-editor-performance-test';

const formatContent = `# 格式与交互覆盖测试

这是一段普通段落，用于测试中文、English、12345、标点和连续输入。

## 行内格式

**粗体文本**、*斜体文本*、~~删除线文本~~、\`行内代码\`，以及 [可点击链接](https://example.com/path?q=dailytime)。

### 复杂内容

> 引用内容用于验证点击格式化文本时的光标位置。

- 无序列表项目
- 包含很长的 URL：https://example.com/a-very-long-path/with-many-segments?editor=selection&mode=performance

1. 有序列表第一项
2. 有序列表第二项

- [ ] 未完成任务：点击复选框只应修改当前任务
- [x] 已完成任务：继续输入、删除和撤回都应保持光标

\`\`\`ts
const message = 'code block';
console.log(message);
\`\`\`

---

图片测试：请通过编辑器的上传或粘贴功能插入图片，验证图片节点、附件路径和保存结果。`;

const paragraph = (index: number): string =>
  `这是第 ${index} 个性能测试段落。它包含中文内容、English words、数字 ${index * 17}、特殊符号 @#$% 和一个长链接 https://example.com/performance/${index}/selection-stability，用于观察滚动、点击和连续输入是否保持流畅。`;

const performanceContent = [
  '# 长文档切换与性能测试',
  '',
  '本文档用于验证长内容下的编辑、滚动、选区恢复、撤回和保存性能。',
  '',
  ...Array.from({ length: 200 }, (_, index) => {
    const number = index + 1;
    if (number % 25 === 0) return `## 第 ${number} 组标题\n\n${paragraph(number)}`;
    if (number % 20 === 0) return `> 第 ${number} 组引用\n> ${paragraph(number)}`;
    if (number % 4 === 0) return `- [ ] 第 ${number} 个任务\n- [x] 第 ${number} 个已完成任务`;
    if (number % 10 === 0) return `\`\`\`text\n${paragraph(number)}\n\`\`\``;
    return paragraph(number);
  }),
].join('\n\n');

export function createEditorTestWorkspace(existing: RuntimeState): RuntimeState {
  const project: RuntimeProject = {
    id: EDITOR_TEST_PROJECT_ID,
    name: '编辑器重构验收',
    color: '#6f9f91',
  };
  const common = {
    project: project.id,
    updated: '刚刚',
    planned: null,
    plannedTime: null,
    status: '未开始' as const,
    tags: ['编辑器测试'],
    attachments: [],
  };
  const docs: RuntimeDocument[] = [
    {
      ...common,
      id: EDITOR_FORMAT_DOCUMENT_ID,
      title: '格式与交互覆盖测试',
      content: formatContent,
    },
    {
      ...common,
      id: EDITOR_PERFORMANCE_DOCUMENT_ID,
      title: '长文档切换与性能测试',
      content: performanceContent,
    },
  ];
  return {
    projects: [...existing.projects.filter((item) => item.id !== project.id), project],
    docs: [
      ...existing.docs.filter((item) => !docs.some((fixture) => fixture.id === item.id)),
      ...docs,
    ],
  };
}

export function removeEditorTestWorkspace(existing: RuntimeState): RuntimeState {
  return {
    projects: existing.projects.filter((project) => project.id !== EDITOR_TEST_PROJECT_ID),
    docs: existing.docs.filter((document) => document.project !== EDITOR_TEST_PROJECT_ID),
  };
}
