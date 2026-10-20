/**
 * @file ssr-cache-purge.ts
 * @description 经本站代理的内容写请求完成后清空公开页面的 SSR HTML 缓存，让发布、留言、评论即时可见；
 * 同时让搜索引擎收录开关的服务端缓存失效，robots.txt、robots meta 与站点地图随站点设置保存立即生效
 * @author TixXin
 * @since 2026-10-16
 */
import { invalidateSiteSearchIndexing } from '../utils/siteIndexing'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', (event) => {
    if (!shouldPurgeSsrCache(event.method, event.path)) return
    invalidateSiteSearchIndexing()
    // 写入失败的请求也清一次，代价只是下一次 SSR 重新渲染。
    void purgeSsrCache().catch(() => {})
  })
})
