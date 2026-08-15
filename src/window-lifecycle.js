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
    const redirectOutside = (event, url) => {
      if (shouldAllowNavigation(url, allowedOrigin)) return
      event.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    }
    // will-navigate fires for page-initiated navigations (links, location
    // changes); our own loadURL calls are not affected.
    mainWindow.webContents.on('will-navigate', redirectOutside)
    // will-redirect fires on server-side redirects (e.g. a 302 from the local
    // page to an external site) — same policy applies.
    mainWindow.webContents.on('will-redirect', redirectOutside)
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
