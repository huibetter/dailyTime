# DailyTime 桌面开发说明

## 环境要求

- Node.js 22 或兼容的现代 Node.js 版本。
- Rust stable、Cargo 和对应平台的桌面构建工具链。
- Windows 开发需要 WebView2 Runtime；Debian 13 Linux 依赖见 [Debian 发布说明](./debian-linux.md)。

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

Linux 发布使用 `npm run tauri:build -- --bundles deb,appimage`，产物位于 `src-tauri/target/release/bundle/`。

## 工程边界

- React 页面和交互位于 `src/`。
- 本地数据类型和数据库访问位于 `src/data/`。
- Tauri 配置、Rust 插件注册和 SQLite 迁移位于 `src-tauri/`。
- 浏览器预览使用 `localStorage` 持久化项目、文档和界面设置；Tauri 运行时使用 SQLite，首次启动只创建空的默认工作空间。
- 桌面端本机用户配置保存在 SQLite 的 `app_settings` 表，旧版本的 `localStorage` profile 会在首次启动时迁移；已有桌面数据不会自动清理。

## 当前阶段限制

- 附件复制、`.dailytime` 备份和恢复尚未实现。
- 当前尚未提供浏览器 Demo 数据迁移到桌面版的能力。
- 当前 Linux 首发目标为 Debian 13（trixie）amd64，首发产物为 `.deb` 和 AppImage。
- 不按系统复制 `src-linux` 等源码目录；React、数据层和 Tauri 业务代码保持共用，系统差异集中在构建配置和必要的平台适配层。
