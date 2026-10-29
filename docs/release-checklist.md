## 发布检查

### 本地质量门禁

```bash
npm run check
npm run rust:check
```

`npm run check` 依次执行版本一致性、格式、TypeScript、单元测试和隔离前端构建。`npm run rust:check` 执行 Rust 格式、编译和 Clippy 检查。

### 发布前检查

- 确认 `package.json`、`src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml` 版本一致。
- 确认数据库迁移和 `.dailytime` 备份格式版本未被意外修改。
- 使用 `v*` 标签触发跨平台构建矩阵。
- 验证 Windows 安装包、Linux `.deb`/AppImage 和 macOS 包的启动与数据恢复。
- 发布前保留一份未加密 `.dailytime` 备份，并记录构建提交号。

### 升级与回滚

- 覆盖安装后验证项目、文档、标签和设置仍可读取。
- 数据库迁移失败时不得删除用户数据目录。
- 安装包验证失败时保持 draft release，不将其标记为正式版本。
- 回滚优先使用上一版本安装包和最近一次 `.dailytime` 备份。
