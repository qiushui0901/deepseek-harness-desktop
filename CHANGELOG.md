# Changelog

## 0.1.0 (2026-08-14)

- Added: Electron 薄壳——端口探测、自动拉起 `dsh web` 后端、原生窗口加载 Web UI、后端崩溃重启、单实例锁、`--smoke` 冒烟模式。
- Added: 配置（`userData/config.json` + `DSH_DESKTOP_*` 环境变量覆盖）。
- Added: 启动等待页、错误页（含 HTML 转义）、菜单（重新加载 / 浏览器打开 / 后端日志 / DevTools）。
- Added: Windows 支持——`npx.cmd` 命令解析、`taskkill /T` 进程树回收、win 构建脚本。
- Fixed: 应用图标鲸鱼占满画布（1024×1024 + viewBox 裁剪到路径包围盒）。
- Fixed: macOS 图标适配——图标改为苹果标准圆角矩形（824×824、rx 185、透明四角），与其他应用图标一致；渲染器从 qlmanage（强制不透明背景）改为 sips（保留透明）。
- Fixed: 图标鲸鱼位置偏离中心 92px——组合图标时按包围盒原点居中（实际 y 从 6.94 开始），改为按包围盒中心居中 + 渲染后像素级光学校正（bbox 中心精确落在 512,512）；图标组合逻辑移入 `scripts/make-icons.mjs`（源图为 `assets/whale.svg`）。
- Fixed: Finder/Explorer 双击启动时后端无法自动拉起——GUI 启动的 PATH 为空，npx 装在 nvm/Homebrew 等目录找不到；新增 `resolveCommandPath`：按 PATH → nvm → Homebrew → 系统目录 → Windows npm 目录顺序解析命令绝对路径，并把所在目录注入子进程 PATH（npx 脚本才能找到 node）。
- Added: 更新感知——启动后静默查询 npm registry 最新 `@deepseek-ai/dsh` 版本，与 npx 缓存版本对比，发现新版弹窗「立即更新」（重启后端即拉取新版）；菜单「窗口 → 检查更新…」手动检查；离线静默跳过。
- Added: 配置项 `updateNotifications`（自动检查开关）与 `dshVersion`（固定后端版本，默认跟随最新）；环境变量 `DSH_DESKTOP_DSH_VERSION`。
- Added: `src/updates.js`（registry 查询、npx 缓存扫描、semver 比较）+ 8 个单元测试（共 29 个）。
- Fixed: `--smoke` 退出确定化（显式回收后端后 `app.exit(0)`）。
- Changed: 源码模块化为 `src/`（main / dsh-service / window-options / window-lifecycle / error-page）。
- Added: 单元测试（`node --test`，16 个用例：配置解析、端口探测、命令解析、窗口选项、错误页转义）。
- Added: 开源规范化——MIT License、`third-party-licenses/`（上游 MIT 声明）、双语 README、`.npmrc`、完整 package.json 元数据。
- Added: `scripts/smoke-packaged.mjs` 打包冒烟脚本、`scripts/after-pack.cjs` macOS ad-hoc 签名。
- Added: 图标全套 `icon.icns` / `icon.ico`（`npm run icons` 一键生成）。
- Added: `website/` 落地页（含 Vercel 部署配置）。
- Added: GitHub Actions `release.yml`——`v*` tag 触发四平台矩阵构建 + 测试 + 冒烟 + 自动发布 Release。
- Added: Linux x64（AppImage + deb）构建目标。
