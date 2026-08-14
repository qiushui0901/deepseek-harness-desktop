import assert from 'node:assert/strict'
import test from 'node:test'
import { buildErrorHtml } from '../src/error-page.js'

const base = { appTitle: 'Test App', title: '出错', message: '详情', retryUrl: 'http://127.0.0.1:3080' }

test('buildErrorHtml renders title, message and retry link', () => {
  const html = buildErrorHtml(base)
  assert.match(html, /<h1>出错<\/h1>/)
  assert.match(html, /<p>详情<\/p>/)
  assert.match(html, /<a href="http:\/\/127\.0\.0\.1:3080">重试<\/a>/)
})

test('buildErrorHtml escapes HTML in title, message and url', () => {
  const html = buildErrorHtml({
    ...base,
    title: '<script>alert(1)</script>',
    message: 'a < b && c > d & "x"',
    retryUrl: 'http://127.0.0.1:3080/?a=1&b=<x>',
  })
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /a &lt; b &amp;&amp; c &gt; d &amp; &quot;x&quot;/)
  assert.ok(!html.includes('<x>'))
})
