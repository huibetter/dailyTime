# DailyTime 桌面开发说明

## 环境要求

- Node.js 22 或兼容的现代 Node.js 版本。
- Rust stable、Cargo 和 Windows MSVC 工具链。
- Windows 开发需要 WebView2 Runtime。

## 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run tauri:dev
npm run tauri:build
```

`npm run build` 只构建前端；`npm run tauri:build` 会先构建前端，再生成桌面安装包。

## 工程边界

- React 页面和交互位于 `src/`。
- 本地数据类型和数据库访问位于 `src/data/`。
- Tauri 配置、Rust 插件注册和 SQLite 迁移位于 `src-tauri/`。
- 浏览器预览使用 `localStorage` 持久化项目、文档和界面设置；Tauri 运行时使用 SQLite，首次启动只创建空的默认工作空间。
- 桌面端本机用户配置保存在 SQLite 的 `app_settings` 表，旧版本的 `localStorage` profile 会在首次启动时迁移；已有桌面数据不会自动清理。

## 当前阶段限制

- 附件复制、`.dailytime` 备份和恢复尚未实现。
- 当前尚未提供浏览器 Demo 数据迁移到桌面版的能力。
- 首个实际发布目标为 Windows 10/11 x64；Linux/macOS 仅完成架构兼容准备。
