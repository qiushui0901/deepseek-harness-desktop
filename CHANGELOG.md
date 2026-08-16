# Changelog

## 0.1.5 (unreleased)

- Fixed: 睡眠唤醒/长时间空闲后白屏——harness 前端只在"检测到"事件流关闭时才自动重连，而睡眠/空闲会造成**半开连接**（双方都感知不到断开，永不触发重连）；桌面壳新增四层自动恢复：`powerMonitor` 唤醒后自动重载、渲染进程崩溃/无响应（30 秒宽限）自动重载、GPU 进程崩溃后重载（macOS 唤醒白窗）、系统空闲超 `idleReloadMinutes`（默认 30 分钟，可配置/可关闭）自动重载刷新连接。浏览器端同样受半开连接影响（需上游服务端心跳才能真正根治）。
- Added: 配置项 `idleReloadMinutes`（默认 30，`0` 关闭）+ 环境变量 `DSH_DESKTOP_IDLE_RELOAD_MINUTES`。
- Fixed: `stopBackend` POSIX 下可能永久等待（P1）——结算安全网（8s，可注入 `settleMs`）现覆盖所有平台，并在注册 `exit` 监听后复查退出状态；新增真实子进程测试（SIGTERM 忽略 → SIGKILL 升级、安全网兜底、已退出直返）。
- Fixed: 系统空闲无条件刷新健康页面（P2）——空闲重载现在只在**后端健康**（`probeHarness` 通过）时触发（健康后端 + 空闲切断的事件流 = 半开故障；后端宕机时跳过，交给崩溃恢复路径）；另增每 60 秒的渲染进程存活探测（`executeJavaScript` 2s 超时），挂死渲染进程无需等 `unresponsive` 事件即可恢复。
- Fixed: 无效空闲配置导致 NaN 每分钟刷新（P2）——`idleReloadMinutes` 用 `Number.isFinite` 校验，非法值回退默认 30。
- Fixed: 唤醒时可能连续刷新两次（P2）——空闲重载改走 `scheduleReload`（与 resume/GPU 重载合并防抖）。
- Added: 单元测试 4 个（NaN 配置、stopBackend 三态），共 51 个。

## 0.1.4 (2026-08-15)

- Fixed: 冒烟测试假阳性——`did-finish-load` 提前挂载后，启动页（file:）先触发导致后端未就绪就"通过"（v0.1.3 的 CI 四平台全为假阳性）；现在只接受 Harness 应用 URL（`http://127.0.0.1:<port>`），启动页跳过、其他页面直接失败。
- Fixed: 就绪探测只做一次 HTTP 身份检查——后端先回启动页/503 时永久错过就绪（P1）；改为每 ~3 秒重复一次带硬超时的身份检查（TCP 每 tick 探测，HTTP 检查由 2s 竞速包裹，防止 Windows 上 fetch 悬挂）。
- Fixed: 更新/崩溃重启竞态（P1）——`stopBackend` 现在返回等待进程真正退出的 Promise；重启前先等旧进程退出并释放端口，`backendStopping` 标记压制"预期退出"被误判为崩溃弹窗/重复启动。
- Fixed: 服务端重定向绕过导航限制（P2）——`will-redirect` 复用同源策略拦截 302 跳转；`probeHarness` 探测请求设置 `redirect: 'manual'`，本地非 Harness 服务无法用重定向到含 `__DSH_BOOT__` 的外部页面冒充。
- Changed: CI Windows/Linux 冒烟前新增 `scripts/prewarm-backend.mjs`——先把后端起起来跑就绪再杀掉（预热 npx 缓存 + Defender 文件缓存，Windows 冷启动可达 10+ 分钟）；冒烟超时放宽至 25 分钟。
- Added: 单元测试 2 个（持续身份检查回归、302 重定向不通过），共 47 个。

## 0.1.3 (2026-08-15)

- Fixed: Windows 后端启动 ENOENT——Node 在 Windows 上同时安装 `npx`（无扩展名 POSIX 脚本）、`npx.cmd`、`npx.exe`，命令解析优先匹配到了无法直接 spawn 的无扩展名文件；win32 上现在只查找 `.exe` → `.cmd`。这是 Windows 打包冒烟失败的根因（此前误判为 runner 慢）。
- Changed: CI 冒烟确定性——`did-finish-load` 监听器在窗口创建后立即挂载；失败路径（spawn 错误、就绪超时、端口被非 Harness 占用）在冒烟模式下显式 `exit(1)` 并输出原因；新增 `uncaughtException`/`unhandledRejection` 全局钩子。
- Changed: CI——macos-13（已退役，runner 永远排不到）改用 `macos-15-intel`；windows/linux 冒烟前预热 npx 缓存；linux 冒烟传 `--no-sandbox`（runner 无 SUID sandbox）并预装 Electron 运行库。
- Added: 单元测试 1 个（win32 命令解析回归），共 45 个。

## 0.1.2 (2026-08-15)

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
