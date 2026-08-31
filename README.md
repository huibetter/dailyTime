# DailyTime

DailyTime 是一个基于 React、TypeScript、Vite 和 Tauri 的本地项目与文档管理应用。

## 功能概览

- 按项目管理文档与笔记
- 支持 Markdown 编辑与预览
- 文档状态管理：未开始、进行中、已完成
- 计划日期与时间，并提供日历排期视图
- 标签、搜索和附件管理
- 本地数据存储与工作区备份/恢复
- 支持 Web 开发模式及 Tauri Windows 桌面应用构建

## 环境要求

- Node.js（建议使用当前 LTS 版本）
- npm
- 如需构建桌面应用：Rust、Cargo，以及 Tauri 2 所需的 Windows 开发环境

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

启动后访问终端输出的地址，通常为：

- http://localhost:1420/

如需让局域网内其他设备访问：

```bash
npm run dev -- --host 0.0.0.0
```

## 构建 Web 版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。构建流程会先执行 TypeScript 类型检查，再执行 Vite 生产构建。

本地预览生产构建：

```bash
npm run preview
```

## 构建/运行 Tauri 桌面应用

开发模式：

```bash
npm run tauri dev
```

构建 Windows 安装包：

```bash
npm run tauri build
```

Tauri 配置位于 `src-tauri/tauri.conf.json`，默认应用名称为 `DailyTime`，安装包目标为 Windows NSIS。

## 测试

```bash
npm test
```

## 项目结构

```text
src/
├─ data/          示例种子数据
├─ services/      数据仓储与备份服务
├─ test/          Vitest 测试
├─ types/         TypeScript 领域类型
├─ utils/         日期、排序、Markdown 等工具
├─ main.tsx       React 应用入口
└─ styles.css     全局样式
src-tauri/        Tauri 桌面端配置与 Rust 工程
doc/              项目文档参考
public/            静态资源（如有）
dist/              Web 生产构建产物
```

## 数据说明

应用默认将项目和文档数据保存在本地浏览器存储中；桌面端通过 Tauri 运行时提供本地应用环境。备份与恢复相关逻辑位于 `src/services/backup.ts`。

## 当前开发状态

截至 2026 年 8 月 31 日，Web 生产构建已验证通过：

```text
npm run build  ✓
```

如果依赖目录不存在或依赖不完整，请先重新执行 `npm install`。
