import assert from 'node:assert/strict'
import test from 'node:test'
import { createWindowOptions } from '../src/window-options.js'

test('renderer is sandboxed on every platform', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    const options = createWindowOptions(platform)
    assert.equal(options.webPreferences.contextIsolation, true, platform)
    assert.equal(options.webPreferences.nodeIntegration, false, platform)
    assert.equal(options.webPreferences.sandbox, true, platform)
  }
})

test('window starts hidden and shows only when ready', () => {
  const options = createWindowOptions('darwin')
  assert.equal(options.show, false)
  assert.equal(options.width, 1280)
  assert.equal(options.height, 840)
  assert.ok(options.minWidth >= 900)
  assert.ok(options.minHeight >= 600)
})

test('Windows auto-hides the menu bar, macOS keeps it', () => {
  assert.equal(createWindowOptions('win32').autoHideMenuBar, true)
  assert.equal(createWindowOptions('darwin').autoHideMenuBar, false)
})

test('dark background by default, light when asked', () => {
  assert.equal(createWindowOptions('darwin', true).backgroundColor, '#0e1116')
  assert.equal(createWindowOptions('darwin', false).backgroundColor, '#ffffff')
})

test('icon points at the packaged asset', () => {
  const icon = createWindowOptions('darwin').icon
  assert.ok(icon.endsWith(pathJoin('assets', 'icon.png')), icon)
})

function pathJoin(...parts) {
  // eslint-disable-next-line no-undef
  return parts.join(process.platform === 'win32' ? '\\' : '/')
}
