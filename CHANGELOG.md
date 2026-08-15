# Changelog

## 0.1.2 (unreleased)

- Fixed: 端口探测不验证服务身份——TCP 可连接即视为 Harness，任何占用 3080 的服务都会被挂接；改为 HTTP 健康检查（`probeHarness`），要求响应携带 Harness 特征标记 `__DSH_BOOT__`，并区分「无监听 / 非 Harness 服务 / 正常」，非 Harness 占用时显示明确错误页。
- Fixed: 同窗跨源导航未拦截——新增 `will-navigate` 拦截（`src/navigation.js` 同源判定），页面发起的跨源导航一律交给系统浏览器，与 README 安全模型一致；`loadURL` 等程序化导航不受影响。
- Fixed: SIGKILL 兜底失效——`proc.killed` 只表示信号已发送而非进程已退出；改为监听 `exit` 事件与 `exitCode === null` 判断，SIGTERM 3 秒未退出才补 SIGKILL。
- Fixed: 固定版本与更新提示冲突——新增 `resolveUpdateState` 状态机：配置 `dshVersion` 后，若 registry 有更新，提示改为「已固定版本」说明（不再提供无效的「立即更新」）。
- Fixed: 后端崩溃重启后页面未重新加载——`startBackend()` 完成后显式 `loadURL` 重载页面，不再依赖旧页面自动重连。
- Added: 单元测试 15 个（健康检查 6、导航策略 3、更新状态机 6），共 44 个。
- Fixed: `--smoke` 模式下后端退出不再弹模态对话框（避免 CI 冒烟被对话框卡死）。
- Changed: 配置自定义后端命令（config.json 的 command/cwd，如指向本地 checkout）时，更新检查自动跳过（registry 更新对自定义命令不适用）。

## 0.1.1 (2026-08-14)

- Fixed: 复制粘贴失效——自定义菜单缺少标准 Edit 菜单（剪切/复制/粘贴/全选），macOS 与 Windows 的 Cmd/Ctrl+C/V/X/A 快捷键全部失效；补充 `editMenu` role。
- Fixed: macOS 图标适配——图标改为苹果标准圆角矩形（824×824、rx 185、透明四角），与其他应用图标一致；渲染器从 qlmanage（强制不透明背景）改为 sips（保留透明）。
- Fixed: 图标鲸鱼位置偏离中心 92px——组合图标时按包围盒原点居中（实际 y 从 6.94 开始），改为按包围盒中心居中 + 渲染后像素级光学校正（bbox 中心精确落在 512,512）；图标组合逻辑移入 `scripts/make-icons.mjs`（源图为 `assets/whale.svg`）。
- Fixed: Finder/Explorer 双击启动时后端无法自动拉起——GUI 启动的 PATH 为空，npx 装在 nvm/Homebrew 等目录找不到；新增 `resolveCommandPath`：按 PATH → nvm → Homebrew → 系统目录 → Windows npm 目录顺序解析命令绝对路径，并把所在目录注入子进程 PATH（npx 脚本才能找到 node）。
- Added: 更新感知——启动后静默查询 npm registry 最新 `@deepseek-ai/dsh` 版本，与 npx 缓存版本对比，发现新版弹窗「立即更新」（重启后端即拉取新版）；菜单「窗口 → 检查更新…」手动检查；离线静默跳过。
- Added: 配置项 `updateNotifications`（自动检查开关）与 `dshVersion`（固定后端版本，默认跟随最新）；环境变量 `DSH_DESKTOP_DSH_VERSION`。
- Added: `src/updates.js`（registry 查询、npx 缓存扫描、semver 比较）+ 8 个单元测试（共 29 个）。
- Changed: `scripts/smoke-packaged.mjs` 失败时输出应用输出尾部，便于 CI 诊断。

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
