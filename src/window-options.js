'use strict'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * BrowserWindow options for the desktop shell. The renderer is fully sandboxed:
 * no Node integration, context isolation on, Chromium sandbox on. Windows hides
 * the menu bar (Alt to reveal); macOS keeps the system menu.
 */
export function createWindowOptions(platform = process.platform, dark = true) {
  return {
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'DeepSeek Harness Desktop',
    backgroundColor: dark ? '#0e1116' : '#ffffff',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: platform === 'win32',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  }
}
