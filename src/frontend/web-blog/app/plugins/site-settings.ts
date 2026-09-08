/**
 * @file site-settings.ts
 * @description 页面渲染前读取站点资料，SSR 结果随页面传给浏览器，避免重复初始化请求。
 */
export default defineNuxtPlugin(async () => {
  const site = useSiteSettings()
  if (import.meta.server || !site.available.value) await site.refresh()
})
