# Changelog

## 0.1.0 (2026-08-14)

- Added: Electron 薄壳——端口探测、自动拉起 `dsh web` 后端、原生窗口加载 Web UI、后端崩溃重启、单实例锁、`--smoke` 冒烟模式。
- Added: 配置（`userData/config.json` + `DSH_DESKTOP_*` 环境变量覆盖）。
- Added: 启动等待页、错误页（含 HTML 转义）、菜单（重新加载 / 浏览器打开 / 后端日志 / DevTools）。
- Added: Windows 支持——`npx.cmd` 命令解析、`taskkill /T` 进程树回收、win 构建脚本。
- Fixed: 应用图标鲸鱼占满画布（1024×1024 + viewBox 裁剪到路径包围盒）。
- Fixed: `--smoke` 退出确定化（显式回收后端后 `app.exit(0)`）。
- Changed: 源码模块化为 `src/`（main / dsh-service / window-options / window-lifecycle / error-page）。
- Added: 单元测试（`node --test`，16 个用例：配置解析、端口探测、命令解析、窗口选项、错误页转义）。
- Added: 开源规范化——MIT License、`third-party-licenses/`（上游 MIT 声明）、双语 README、`.npmrc`、完整 package.json 元数据。
- Added: `scripts/smoke-packaged.mjs` 打包冒烟脚本、`scripts/after-pack.cjs` macOS ad-hoc 签名。
- Added: 图标全套 `icon.icns` / `icon.ico`（`npm run icons` 一键生成）。
- Added: `website/` 落地页（含 Vercel 部署配置）。
- Added: GitHub Actions `release.yml`——`v*` tag 触发四平台矩阵构建 + 测试 + 冒烟 + 自动发布 Release。
- Added: Linux x64（AppImage + deb）构建目标。
