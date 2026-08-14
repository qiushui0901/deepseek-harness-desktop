'use strict'

export function buildErrorHtml({ appTitle, title, message, retryUrl }) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(appTitle)} — 错误</title>
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0e1116;color:#e6edf3;font:14px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
  .box{max-width:640px;padding:32px;border:1px solid #2d333b;border-radius:12px;background:#161b22}
  h1{font-size:18px;margin:0 0 12px} p{white-space:pre-wrap;margin:0 0 20px;color:#9aa4b2}
  a{display:inline-block;color:#58a6ff;border:1px solid #58a6ff;border-radius:6px;padding:6px 16px;text-decoration:none}
  a:hover{background:#1f6feb22}
</style></head><body><div class="box">
  <h1>${esc(title)}</h1><p>${esc(message)}</p>
  <a href="${esc(retryUrl)}">重试</a>
</div></body></html>`
}

export function loadErrorPage(win, opts) {
  if (!win || win.isDestroyed()) return
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildErrorHtml(opts)))
}
