/**
 * @file site-settings.ts
 * @description 页面渲染前读取站点资料，SSR 结果随页面传给浏览器，避免重复初始化请求。
 */
export default defineNuxtPlugin({
  name: 'site-settings',
  // 与其他并行插件（如 SSR 数据预取）同时发起，不再串行占一整个往返
  parallel: true,
  async setup() {
    const site = useSiteSettings()
    if (import.meta.server || !site.available.value) await site.refresh()
  },
})
