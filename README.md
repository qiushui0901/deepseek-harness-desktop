<h1 align="center">
  <img src="assets/icon.png" width="72" alt="DeepSeek Harness Desktop logo" />
  <br />
  DeepSeek Harness Desktop
</h1>

<p align="center">
  DeepSeek Harness（<a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>）
  的轻量、本地优先、跨平台桌面外壳。
</p>

<p align="center">
  <a href="README.en.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/qiushui0901/deepseek-harness-desktop?style=flat-square&color=171513" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-171513.svg?style=flat-square" /></a>
  <a href="https://github.com/qiushui0901/deepseek-harness-desktop/actions/workflows/release.yml"><img alt="Release build" src="https://github.com/qiushui0901/deepseek-harness-desktop/actions/workflows/release.yml/badge.svg" /></a>
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-171513.svg?style=flat-square" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-171513.svg?style=flat-square" />
  <img alt="Linux" src="https://img.shields.io/badge/Linux-x64-171513.svg?style=flat-square" />
</p>

DeepSeek Harness Desktop 把官方 DeepSeek Harness Web 体验封装成独立桌面应用：不用手动敲 CLI、不用管理本地端口，保留完整的 Harness 界面。

本项目只负责桌面托管，**不 fork、不修改、不注入、不重写 Harness UI**。模型、会话、设置、插件与智能体能力全部由官方 `@deepseek-ai/dsh` 提供。

> [!IMPORTANT]
> 这是非官方社区封装，处于早期阶段。macOS 构建未做 Apple 公证，Windows 构建未做商业代码签名。应用通过 `npx` 启动 Harness 后端，因此**运行机器需要 Node.js ≥ 18**。

## 下载

| 平台 | 架构 | 包 | 下载 |
| --- | --- | --- | --- |
| macOS | Apple Silicon | DMG | [Apple Silicon 版](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-arm64.dmg) |
| macOS | Intel | DMG | [Intel Mac 版](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-x64.dmg) |
| Windows | x64 | 安装程序 | [Windows 安装版](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-windows-x64.exe) |
| Windows | x64 | 绿色 ZIP | [Windows 绿色版](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-windows-x64.zip) |
| Linux | x64 | AppImage | [AppImage](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-linux-x86_64.AppImage) |
| Debian / Ubuntu | x64 | deb | [deb 包](https://github.com/qiushui0901/deepseek-harness-desktop/releases/latest/download/DeepSeek-Harness-Desktop-0.1.4-linux-amd64.deb) |

全部历史版本见 [GitHub Releases 页面](https://github.com/qiushui0901/deepseek-harness-desktop/releases)。

## 这个项目解决什么

DeepSeek Harness 本身已提供完整的智能体运行时和 Web UI。本项目补齐桌面产品所需的宿主能力：

- 自动启动/停止本地 Harness 服务
- 若你已手动启动 Harness，则直接挂接，绝不重复拉起
- 等 Harness 就绪后再显示窗口
- 单实例桌面窗口与安全的外链处理
- 开启沙箱、`contextIsolation` 与导航限制
- 打包 macOS、Windows、Linux 可安装发行版

## 特性

- 本地服务一就绪即打开官方 Harness 界面
- 服务启动期间显示轻量加载页
- 检测到已运行的 `dsh web` 时直接挂接，不启动第二个后端
- 完整保留设置、模型、会话、插件与智能体体验
- 退出时优雅终止 Harness 子进程（Windows 上回收整个进程树）
- 后端崩溃时提供一键重启；后端日志在菜单里一键打开
- 只监听 `127.0.0.1`
- Windows x64 安装版与绿色 ZIP
- Linux x64 AppImage 与 deb

## 运行要求

- **Node.js ≥ 18**——应用通过 `npx --yes @deepseek-ai/dsh web` 启动官方 Harness 后端（首次启动会下载该包）。

## 安装

### macOS

macOS 构建为 ad-hoc 签名、未公证。首次启动：

1. 打开 DMG，把 **DeepSeek Harness Desktop** 拖进**应用程序**。
2. 尝试打开；若被拦截，点击**完成**。
3. 打开**系统设置 → 隐私与安全性**。
4. 在**安全性**区域找到 DeepSeek Harness Desktop，点击**仍要打开**。
5. 再次点击**打开**确认。

一般只需确认一次。

### Windows

安装包未做商业签名，若出现 SmartScreen 提示：

1. 点击**更多信息**。
2. 点击**仍要运行**。
3. 完成安装向导。

### Linux

- AppImage：`chmod +x DeepSeek-Harness-Desktop-*.AppImage` 后直接运行。
- Debian / Ubuntu：用软件安装器打开 deb，或 `sudo apt install ./DeepSeek-Harness-Desktop-*.deb`。

## 更新机制

**后端（DeepSeek Harness）**：后端通过 `npx --yes @deepseek-ai/dsh web` 启动，而 npx 每次都会向 npm registry 解析**最新发布版本**——所以只要上游把新版本发布到 npm，下次启动后端就是新版，无需任何操作。

为了让更新可见，应用会在启动后静默查询 registry，与本地缓存版本对比：

- 发现新版 → 弹窗提示「立即更新」（重启后端即可拉取新版本）或「稍后」
- 菜单「窗口 → 检查更新…」可随时手动检查
- 离线或查询失败时静默跳过，不打扰使用

如需**固定版本**（可复现构建），在配置中设置 `dshVersion`。

**壳本身（本应用）**：通过本仓库的 GitHub Releases 发布（推送 `v*` tag 由 CI 自动构建），升级请关注 Releases 页面。

## 配置

配置文件位于 Electron `userData` 目录：macOS 为
`~/Library/Application Support/DeepSeek Harness Desktop/config.json`，
Windows 为 `%APPDATA%\DeepSeek Harness Desktop\config.json`。文件可选，所有字段均有默认值：

```json
{
  "port": 3080,
  "command": "npx",
  "args": ["--yes", "@deepseek-ai/dsh", "web", "--port", "3080"],
  "cwd": "/path/to/deepseek-harness",
  "autoStart": true,
  "shutdownOnQuit": true,
  "updateNotifications": true,
  "idleReloadMinutes": 30,
  "dshVersion": "0.1.0-rc.6",
  "startupTimeoutMs": 180000
}
```

| 键 | 含义 |
| --- | --- |
| `port` | 探测与服务的回环端口（默认 `3080`） |
| `command` / `args` / `cwd` | 后端启动命令；把 `cwd` 指向本地 checkout 可改用 `pnpm dsh web` |
| `autoStart` | 端口无监听时自动启动后端（默认 `true`） |
| `shutdownOnQuit` | 退出时停止由本应用启动的后端（默认 `true`） |
| `updateNotifications` | 启动后自动检查 npm 最新版并提示（默认 `true`） |
| `idleReloadMinutes` | 系统空闲超过该分钟数后自动重载页面（刷新事件连接；`0` 关闭，默认 `30`） |
| `dshVersion` | 固定后端版本（如 `0.1.0-rc.6`）；不设置则始终跟随最新版 |
| `startupTimeoutMs` | 就绪等待超时，超时后显示错误页 |

环境变量优先级高于配置文件：

| 变量 | 覆盖 |
| --- | --- |
| `DSH_DESKTOP_PORT` | `port` |
| `DSH_DESKTOP_COMMAND` | `command` |
| `DSH_DESKTOP_ARGS` | `args`（空格分隔字符串） |
| `DSH_DESKTOP_CWD` | `cwd` |
| `DSH_DESKTOP_DSH_VERSION` | `dshVersion` |
| `DSH_DESKTOP_IDLE_RELOAD_MINUTES` | `idleReloadMinutes` |
| `DSH_DESKTOP_STARTUP_TIMEOUT_MS` | `startupTimeoutMs` |

## 安全模型

- Harness 只绑定 `127.0.0.1`
- 渲染进程禁用 Node.js 集成
- 开启 `contextIsolation` 与 Chromium 沙箱
- 新窗口与跨源导航一律交给系统浏览器
- Harness 以独立子进程运行，不在应用进程内

## 运行时架构

```text
DeepSeek Harness Desktop
├── Electron 主进程
│   ├── 单实例窗口
│   ├── 后端子进程生命周期（探测 → 挂接或启动 → 等待就绪）
│   ├── 回环端口就绪检查
│   └── 平台菜单与外链处理
│
├── Harness 子进程（仅当端口无监听时通过 npx 启动）
│   └── @deepseek-ai/dsh web
│       └── http://127.0.0.1:<port>
│
└── 沙箱化 BrowserWindow
    └── DeepSeek Harness Web UI
```

## 开发

```sh
npm install
npm test                 # 单元测试（node --test）
npm run smoke            # 开发模式冒烟（短暂弹出窗口）
npm run pack             # 未打包目录版 macOS .app
npm run smoke:packaged   # 对打包产物做冒烟测试
npm run dist:mac:arm64   # macOS DMG + ZIP（arm64）
npm run dist:mac:x64     # macOS DMG + ZIP（x64）
npm run dist:win         # Windows 安装包 + ZIP（x64）
npm run dist:linux       # Linux AppImage + deb（x64）
```

发布由 GitHub Actions 自动完成：推送 `v*` tag 后，各平台在原生 runner 上构建、跑单元测试与打包冒烟，并自动把产物发布到 GitHub Release。

## 验证状态

| 平台 | 打包 | 打包启动 | Web UI |
| --- | --- | --- | --- |
| macOS Apple Silicon | DMG / ZIP | 通过 | HTTP 200 |
| macOS Intel | DMG / ZIP | CI 验证 | HTTP 200 |
| Windows x64 | NSIS / ZIP | CI 验证 | HTTP 200 |
| Linux x64 | AppImage / deb | CI 验证 | HTTP 200 |

每个发布包都在对应的 GitHub runner 上构建，并在发布前运行打包冒烟测试。

## 已知限制

- 后端通过 `npx` 拉取，首次启动需要 Node.js 与网络（之后走 npx 缓存）
- 上游 DSH 仍是开发者预览版，变化可能很快
- 未集成 Apple Developer ID 签名与公证
- 未集成商业 Windows 代码签名，SmartScreen 可能出现
- 暂不提供 Windows ARM64 与 Linux ARM64 包
- 未集成自动更新

## 上游版本与许可证

本项目采用 [MIT License](LICENSE)。其打包的 DeepSeek Harness 运行时同为 MIT 协议，声明见
[`third-party-licenses/deepseek-harness-LICENSE`](third-party-licenses/deepseek-harness-LICENSE)。

本项目与 DeepSeek 无隶属关系，亦未获其背书。DeepSeek Harness 及相关名称归各自权利人所有。应用图标使用了上游 DeepSeek Harness Web favicon 的鲸鱼图形。
