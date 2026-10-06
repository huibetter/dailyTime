# 2026-10-05 实现 Typora 风格 Markdown 编辑器`n
## 2026-10-05-19
- 修改人：Codex
- 修改时间：2026-10-05-19
- 修改摘要：将文档编辑器改为默认 Markdown 源码模式，新增源码/预览切换、轻量格式工具栏、常用快捷键、列表续写、缩进、任务列表预览回写和全局模式记忆；补齐表格、代码块等核心 Markdown 预览样式与安全渲染测试。
- 影响范围：src/main.jsx、src/styles.css、src/lib/markdown.ts、src/lib/markdown-editor.ts、src/lib/document-utils.ts；不改变现有文档 Markdown 存储原则。

## 2026-10-05-19
- 修改人：Codex
- 修改时间：2026-10-05-19
- 修改摘要：新增桌面端本地资源保存能力，图片和附件使用应用数据目录下的文档资源路径与附件元数据；加载、保存和删除文档时同步处理附件记录，浏览器版导入本地资源时给出桌面端提示。
- 影响范围：src/lib/resources.ts、src/data/runtime-storage.ts、附件导出兼容逻辑；兼容已有字符串附件和旧备份数据。

## 2026-10-05-19
- 修改人：Codex
- 修改时间：2026-10-05-19
- 修改摘要：新增 Markdown 编辑纯函数、资源路径和渲染回归测试，覆盖格式化选区、列表续写、缩进、任务切换、表格、代码块、链接、图片和危险内容清洗。
- 影响范围：src/lib/markdown-editor.test.ts、src/lib/resources.test.ts、src/lib/markdown.test.ts、src/lib/document-utils.test.ts。
- 验证结果：
pm run typecheck、
pm test -- --run（19/19）、
pm run build:check、
pm run format:check 和 git diff --check 通过。

## 2026-10-05-19
- 修改人：Codex
- 修改时间：2026-10-05-19
- 修改摘要：清理旧的可编辑 HTML 转换实现，确保新编辑器完全以 Markdown 源码文本为唯一编辑入口。
- 影响范围：src/main.jsx 编辑器实现；不改变文档数据格式。
- 验证结果：清理后重新通过类型检查、19 项单元测试、构建、格式检查和差异检查。

## 2026-10-05-21
- 修改人：Codex
- 修改时间：2026-10-05-21
- 修改摘要：根据浏览器反馈移除源码/预览切换和顶部悬挂工具栏，改为按内容块局部显示 Markdown 源码，并新增编辑区右键格式菜单。
- 影响范围：src/main.jsx、src/styles.css、src/lib/markdown-editor.ts。
- 验证结果：20 项单元测试、类型检查和构建通过。

## 2026-10-05-22
- 修改人：Codex
- 修改时间：2026-10-05-22
- 修改摘要：完成 Windows x64 软件安装包构建检查，确认版本号一致、前端检查通过，并成功生成 NSIS 与 MSI 安装包。
- 影响范围：src-tauri/target/release/bundle/nsis/DailyTime_0.1.4_x64-setup.exe、src-tauri/target/release/bundle/msi/DailyTime_0.1.4_x64_en-US.msi；未修改业务代码。
- 验证结果：
pm run check 通过；Tauri release 构建成功；Windows 安装包为未签名产物；Linux/macOS 目标未在当前 Windows 环境实构建。

## 2026-10-05-23
- 修改人：Codex
- 修改时间：2026-10-05-23
- 修改摘要：清理已废弃的旧编辑器样式和全局源码/预览工具栏规则，保留按内容块编辑所需样式；补充 .gitignore 对 src-tauri/target/、src-tauri/gen/ 的忽略，清理本地临时构建目录。
- 影响范围：.gitignore、src/styles.css、本地未跟踪构建产物；不改变业务数据和接口。
- 验证结果：
pm run format:check、
pm run typecheck、
pm test -- --run（20/20）、
pm run build:check 和 git diff --check 通过。
