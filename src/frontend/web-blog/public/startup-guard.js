/**
 * @file startup-guard.js
 * @description 独立于应用模块的启动兜底：入口失败或超时后露出SSR内容和可用的刷新链接
 * @author TixXin
 * @since 2026-09-07
 */
;(function () {
  let ready = false
  const root = document.documentElement
  const stalled = () => {
    if (!ready) root.classList.add('app-startup-stalled')
  }
  const timer = window.setTimeout(stalled, 12000)
  const failed = (event) => {
    if (event.target instanceof HTMLScriptElement && event.target.src.includes('/_nuxt/')) stalled()
  }
  const rejected = (event) => {
    if (/dynamically imported module|module script/i.test(String(event.reason?.message || event.reason))) stalled()
  }
  const finish = () => {
    ready = true
    window.clearTimeout(timer)
    root.classList.remove('app-startup-stalled')
    window.removeEventListener('error', failed, true)
    window.removeEventListener('unhandledrejection', rejected)
    window.removeEventListener('tixxin:ready', finish)
  }
  window.addEventListener('error', failed, true)
  window.addEventListener('unhandledrejection', rejected)
  window.addEventListener('tixxin:ready', finish)
  window.addEventListener('pagehide', () => window.clearTimeout(timer), { once: true })
})()
