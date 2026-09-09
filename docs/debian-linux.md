# Debian 13 发布说明

## 支持范围

DailyTime 当前以 Debian 13（trixie）`amd64` 作为 Linux 首发验证目标。业务源码与 Windows、macOS 共用，平台差异由 Tauri 打包配置和构建环境处理。

## 系统依赖

开发和本地构建需要 Node.js 22、Rust stable、Cargo，以及以下 Debian 软件包：

```bash
sudo apt update
sudo apt install -y build-essential curl file git \
  libayatana-appindicator3-dev libgtk-3-dev librsvg2-dev \
  libssl-dev libwebkit2gtk-4.1-dev patchelf pkg-config wget
```

## 构建

```bash
npm ci
npm run format:check
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build -- --bundles deb,appimage
```

产物位于 `src-tauri/target/release/bundle/deb/` 和 `src-tauri/target/release/bundle/appimage/`。

## 安装与运行

```bash
sudo apt install ./DailyTime_*.deb
chmod +x DailyTime_*.AppImage
./DailyTime_*.AppImage
```

## 数据与升级

SQLite 数据保存在 Tauri 应用数据目录中。卸载和升级不得手动删除该目录；升级后应验证项目、文档、排期和应用设置仍然存在。首次启动和数据库迁移失败时，应停止发布并保留错误日志。

## 已知边界

- 当前只承诺 Debian 13 `amd64` 首发验证，不承诺 `arm64`。
- 附件复制、`.dailytime` 备份恢复、云同步和自动更新尚未实现。
- AppImage 需要目标系统提供桌面环境和 WebKitGTK 运行库。
