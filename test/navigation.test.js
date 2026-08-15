import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldAllowNavigation } from '../src/navigation.js'

const ORIGIN = 'http://127.0.0.1:3080'

test('same-origin navigations stay in-window', () => {
  assert.equal(shouldAllowNavigation('http://127.0.0.1:3080/some/path', ORIGIN), true)
  assert.equal(shouldAllowNavigation('http://127.0.0.1:3080/?q=1', ORIGIN), true)
})

test('cross-origin http(s) navigations are rejected', () => {
  assert.equal(shouldAllowNavigation('https://example.com/', ORIGIN), false)
  assert.equal(shouldAllowNavigation('http://localhost:3080/', ORIGIN), false) // different host
  assert.equal(shouldAllowNavigation('http://127.0.0.1:9999/', ORIGIN), false) // different port
})

test('non-http(s) URLs are rejected', () => {
  assert.equal(shouldAllowNavigation('data:text/html,<h1>x</h1>', ORIGIN), false)
  assert.equal(shouldAllowNavigation('file:///etc/passwd', ORIGIN), false)
  assert.equal(shouldAllowNavigation('javascript:alert(1)', ORIGIN), false)
  assert.equal(shouldAllowNavigation('not a url', ORIGIN), false)
})
