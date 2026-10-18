/**
 * @file ssr-cache-browser.ts
 * @description 公开页面只在服务端缓存，浏览器每次凭 ETag 向服务端验证，写后清空缓存能立即反映到访客
 */
import { isSsrCachedPage, prepareSsrCachedPageRevalidation } from '../utils/ssrCacheRoutes'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.method !== 'GET' && event.method !== 'HEAD') return
    if (!isSsrCachedPage(event.path)) return
    // 必须在路由缓存处理器之前执行：它读取条件请求头并写入浏览器缓存头
    prepareSsrCachedPageRevalidation(event.node.req, event.node.res)
  })
})
