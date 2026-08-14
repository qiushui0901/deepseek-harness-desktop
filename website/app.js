// Landing page behavior: keep it minimal. Only the terminal steps animate
// (CSS handles that); this file just avoids layout shift and stamps the year.
'use strict'

document.querySelectorAll('footer p').forEach((p) => {
  p.textContent = `${p.textContent} © ${new Date().getFullYear()}`
})
