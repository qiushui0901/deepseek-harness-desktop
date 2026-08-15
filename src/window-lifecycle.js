'use strict'

import { BrowserWindow, shell } from 'electron'
import { shouldAllowNavigation } from './navigation.js'

let mainWindow = null

/**
 * Create the single main window. `splashFile` is loaded first (shown while the
 * backend starts); `onFailLoad` receives (event, code, description, url) for
 * non-file navigations. External links — both new windows and same-window
 * cross-origin navigations — open in the system browser.
 */
export function createMainWindow(options, { splashFile, onFailLoad, allowedOrigin } = {}) {
  mainWindow = new BrowserWindow(options)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (allowedOrigin) {
    // will-navigate fires for page-initiated navigations (links, location
    // changes); our own loadURL calls are not affected. Redirect the main
    // window to the system browser on any cross-origin attempt.
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (shouldAllowNavigation(url, allowedOrigin)) return
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    })
  }
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
