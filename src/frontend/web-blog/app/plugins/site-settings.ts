/**
 * @file site-settings.ts
 * @description 页面渲染前读取站点资料，SSR 结果随页面传给浏览器，避免重复初始化请求。
 */
export default defineNuxtPlugin({
  name: 'site-settings',
  // 与其他并行插件（如 SSR 数据预取）同时发起，不再串行占一整个往返
  parallel: true,
  async setup(nuxtApp) {
    const site = useSiteSettings()
    if (import.meta.server) {
      await site.refresh()
      return
    }
    if (site.available.value) return
    // SSR 读取失败时页面以默认资料渲染；水合前改写会造成不匹配，先按服务端结果水合完成再补读真实资料
    if (nuxtApp.isHydrating) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => site.refresh())
      return
    }
    await site.refresh()
  },
})
