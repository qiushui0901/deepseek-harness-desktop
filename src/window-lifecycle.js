'use strict'

import { BrowserWindow, shell } from 'electron'

let mainWindow = null

/**
 * Create the single main window. `splashFile` is loaded first (shown while the
 * backend starts); `onFailLoad` receives (event, code, description, url) for
 * non-file navigations. External links open in the system browser.
 */
export function createMainWindow(options, { splashFile, onFailLoad } = {}) {
  mainWindow = new BrowserWindow(options)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (onFailLoad) {
    mainWindow.webContents.on('did-fail-load', onFailLoad)
  }
  if (splashFile) mainWindow.loadFile(splashFile)
  return mainWindow
}

export function getMainWindow() {
  return mainWindow
}

export function focusMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}
