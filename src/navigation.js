'use strict'

/**
 * Navigation policy for the main window: only same-origin navigations are
 * allowed inside the window; anything else is handed to the system browser.
 */
export function shouldAllowNavigation(url, allowedOrigin) {
  let target
  try {
    target = new URL(url)
  } catch {
    return false // non-http(s) URLs (data:, file:, javascript:) never navigate in-window
  }
  return target.origin === allowedOrigin
}
