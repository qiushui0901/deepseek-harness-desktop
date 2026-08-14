# dsh-desktop

把 DeepSeek Harness Web UI（`http://127.0.0.1:3080`）包装成桌面应用的薄壳（Electron）。
**不修改 DeepSeek Harness 仓库的任何代码**——本目录是独立项目。

## 原理

Web UI 不是独立站点，它依赖 `dsh web` 后端进程（注入 `window.__DSH_BOOT__`）。
所以桌面壳做三件事：

1. **探测** `127.0.0.1:<port>` 是否已有服务在监听；
2. 没有则**自动拉起**后端（默认 `npx --yes @deepseek-ai/dsh web --port <port>`），轮询等待端口就绪；
3. 就绪后加载 Web UI 到原生窗口。退出时关闭**由本应用拉起**的后端（不影响你手动启动的实例）。

## 使用

```sh
npm install        # 首次
npm start          # 开发运行
npm run pack       # 打包为未签名 .app（dist/mac-arm64 等）
npm run dist       # 打包 dmg / nsis / AppImage
npm run smoke      # 冒烟测试：加载完成后自动退出并打印 SMOKE_OK
```

## Windows

```sh
npm run pack:win   # 免安装版（dist/win-unpacked/DeepSeek Harness Desktop.exe）
npm run dist:win   # 完整产物：安装包 + 绿色单文件 + zip
```

产物在 `dist/`：
- `DeepSeek Harness Desktop Setup 0.1.0.exe` — NSIS 安装包
- `DeepSeek Harness Desktop 0.1.0.exe` — portable 单文件版（免安装）
- `win-unpacked/` — 免安装目录版（复制到 Windows 直接运行，无需构建机）
- `*.zip` — win-unpacked 的压缩包

Windows 注意事项：
- **目标机需安装 Node.js**：后端默认通过 `npx` 启动；也可在 config.json 里把
  `command` 指向本机安装的 dsh（如 `dsh.cmd`）。
- 未签名 exe 首次运行会触发 SmartScreen 提示（"更多信息 → 仍要运行"）；
  正式分发需代码签名证书。
- 退出时会用 `taskkill /T` 回收整个后端进程树，不会残留 npx/dsh 进程。
- macOS 上交叉构建 NSIS 安装包无需额外工具；若你的环境报 wine 缺失，
  可改用 `npm run pack:win` 的免安装目录版，或在 Windows 机器上执行 `npm run dist:win`。

> 后端默认通过 `npx` 使用 npm 上发布的 `@deepseek-ai/dsh`（首次会联网下载）。
> 想用本地 checkout（需已 `pnpm install && pnpm run build`），在配置里改
> `command` 为 `pnpm`、`args` 为 `["dsh","web","--port","3080"]`、
> `cwd` 指向 checkout 目录即可。

## 配置

配置文件位于 Electron `userData` 目录：
macOS `~/Library/Application Support/DeepSeek Harness Desktop/config.json`。
首次运行不存在时使用默认值，可手动创建：

```json
{
  "port": 3080,
  "command": "npx",
  "args": ["--yes", "@deepseek-ai/dsh", "web", "--port", "3080"],
  "cwd": "/path/to/deepseek-harness",
  "autoStart": true,
  "shutdownOnQuit": true,
  "startupTimeoutMs": 180000
}
```

环境变量覆盖（优先级高于配置文件）：

| 变量 | 说明 |
| --- | --- |
| `DSH_DESKTOP_PORT` | 端口，默认 3080 |
| `DSH_DESKTOP_COMMAND` | 后端命令，默认 `npx` |
| `DSH_DESKTOP_ARGS` | 后端参数（空格分隔字符串） |
| `DSH_DESKTOP_CWD` | 后端工作目录 |
| `DSH_DESKTOP_STARTUP_TIMEOUT_MS` | 等待端口就绪的超时（毫秒） |

## 行为细节

- **单实例锁**：重复打开会聚焦已有窗口，不会启动第二个后端。
- **端口已占用**：直接挂接（例如你已手动运行 `dsh web`），退出时不杀它。
- **后端崩溃**：弹窗提示，可一键重启或退出；日志在
  `userData/logs/backend.log`，菜单「打开后端日志」可直达。
- **安全**：`contextIsolation` + `sandbox` 开启，`nodeIntegration` 关闭；
  页面内打开的站外链接交给系统浏览器。
- **端口只能绑 127.0.0.1**（`dsh web` 不支持 `--host 0.0.0.0`），桌面壳天然只服务本机。

## 可选优化（未做，按需再改）

- `titleBarStyle: 'hiddenInset'`（macOS 现代标题栏，需配合页面留出拖拽区域，先验证再改）。
- 系统托盘（最小化到托盘常驻）。
- 开机自启（`app.setLoginItemSettings`）。

## 目录结构

```
main.js              主进程：探测/拉起后端、窗口、菜单、生命周期
splash.html          启动等待页（后端未就绪时显示）
assets/icon.svg      图标源（来自 harness 的 favicon.svg）
assets/icon.png      1024px PNG（由 scripts/make-icons.mjs 生成）
scripts/make-icons.mjs  SVG → PNG 图标生成（macOS qlmanage）
```
