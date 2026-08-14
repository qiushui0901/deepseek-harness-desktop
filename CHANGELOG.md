# Changelog

## 0.1.0 (unreleased)

- Added: Electron 薄壳 `main.js`——端口探测、自动拉起 `dsh web` 后端、原生窗口加载 Web UI、后端崩溃重启、单实例锁、`--smoke` 冒烟模式。
- Added: 配置（`userData/config.json` + `DSH_DESKTOP_*` 环境变量覆盖）。
- Added: 启动等待页 `splash.html`、错误页、菜单（重新加载 / 浏览器打开 / 后端日志 / DevTools）。
- Added: 图标（`assets/icon.svg` 源自 harness favicon，`scripts/make-icons.mjs` 生成 PNG）。
- Added: electron-builder 打包配置（dmg / nsis / AppImage）。
- Added: Windows 支持——`npx.cmd` 命令解析、`taskkill /T` 进程树回收、后端启动失败的友好错误页、win 构建脚本（`pack:win` / `dist:win`，nsis + portable + zip 三种产物）。
- Fixed: `--smoke` 模式退出确定化（显式回收后端后用 `app.exit(0)`，避免页面关闭拦截导致进程残留并占住单实例锁）。
