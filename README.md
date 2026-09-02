# DailyTime

DailyTime 是一款面向个人工作节奏管理的桌面应用，用于组织项目文档、项目排期和日常工作内容。

## 当前状态

项目已完成 Tauri 2 桌面工程基线和 SQLite 本地存储接入，当前处于桌面版持续开发阶段。现已可以构建 Windows 安装包，首发目标为 Windows 10/11 x64。

## 主要功能

- 管理项目文档和项目工作内容。
- 通过时间线查看、编辑和删除排期任务。
- 支持项目级排期和全局项目排期总览。
- 管理文档标签，包括新增、重命名和删除。
- 桌面端使用 SQLite 保存本地数据。
- 支持浏览器开发预览，便于前端交互调试。

## 技术栈

- React + Vite
- TypeScript
- Tauri 2
- Rust
- SQLite

## 环境要求

- Node.js 22 或兼容的现代 Node.js 版本。
- Rust stable、Cargo 和对应平台的桌面构建工具链。
- Windows 开发需要 WebView2 Runtime。

## 快速开始

安装前端依赖：

```bash
npm install
```

启动浏览器开发预览：

```bash
npm run dev
```

启动 Tauri 桌面开发模式：

```bash
npm run tauri:dev
```

## 构建与检查

```bash
npm run typecheck
npm run build
npm run tauri:build
```

`npm run build` 只构建前端资源；`npm run tauri:build` 会先构建前端，再生成桌面应用安装包。

Windows 安装包默认输出到：

```text
src-tauri/target/release/bundle/nsis/
```

当前已生成的 Windows 安装包为 `DailyTime_0.1.0_x64-setup.exe`。

## 项目结构

```text
src/                    React 页面与交互
src/data/               数据模型、数据库连接和运行时存储适配
src-tauri/              Tauri 配置、Rust 入口、SQLite 迁移和打包资源
docs/                   架构说明、开发文档、工作区资料和修改历史
dist/                   前端构建产物
```

## 数据说明

- Tauri 桌面运行时使用 SQLite 保存应用数据。
- 浏览器开发预览继续使用 `localStorage` Demo 数据。
- 桌面端首次启动会创建空的默认工作空间。
- 当前不会自动迁移浏览器 Demo 数据到桌面版。
- 附件复制、`.dailytime` 备份与恢复、云同步和多人协作尚未实现。

## 文档

- [文档索引](./docs/README.md)
- [桌面开发说明](./docs/desktop-development.md)
- [桌面应用架构方案](./docs/superpowers/plans/2026-09-02-desktop-architecture.md)
- [修改历史](./docs/history/)

## 发布计划

1. 优先完成 Windows 10/11 x64 桌面版验证和发布准备。
2. 在核心功能稳定后验证 Linux 和 macOS 打包与运行环境。
3. 后续再评估云同步、真实账号、多人协作、自动更新和数据备份能力。

