/**
 * @file site-indexing.ts
 * @description 博主关闭“允许搜索引擎收录本站”时，按请求把站点标记为不可索引：
 * robots 模块据此输出全站 Disallow 的 robots.txt、noindex 的 robots meta 与 X-Robots-Tag 响应头，站点地图清空。
 * @author TixXin
 * @since 2026-10-20
 */
import { siteSearchIndexing, skipsSiteIndexing } from '../utils/siteIndexing'

/** 高于运行时配置（0）的优先级，确保博主的关闭选择覆盖部署环境的缺省可索引 */
const SITE_SETTINGS_PRIORITY = 1

export default defineNitroPlugin((nitroApp) => {
  // 站点配置初始化中间件在 robots 模块的上下文中间件之前执行，robots.txt 路由与页面 robots 规则都读取这里的结果。
  nitroApp.hooks.hook('site-config:init', async ({ event, siteConfig }) => {
    if (skipsSiteIndexing(event.path)) return
    if (await siteSearchIndexing(event)) return
    // 只在关闭时降级为不可索引；开启时不覆盖部署环境自身的设置（例如预发环境本就禁止索引）。
    siteConfig.push({ _context: 'site-settings:searchIndexing', _priority: SITE_SETTINGS_PRIORITY, indexable: false })
  })
  // 站点地图模块过滤页面时跳过站点级可索引判断，这里显式清空，避免继续向搜索引擎提交地址。
  nitroApp.hooks.hook('sitemap:resolved', async (ctx) => {
    if (!(await siteSearchIndexing(ctx.event))) ctx.urls.length = 0
  })
})
