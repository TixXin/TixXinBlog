/**
 * @file rss-subscribe-links.client.ts
 * @description 全站接管指向本站订阅文件的链接点击，改为打开 RSS 订阅弹窗；
 *              覆盖订阅卡、页脚链接、博主资料卡社交链接等各主题入口，链接本身保持原生地址，
 *              修饰键、中键、右键复制与无脚本场景仍按普通链接处理；后台不接管，便于预览与核对原始地址
 * @author TixXin
 * @since 2026-11-05
 */
import { feedKeyFromClick } from '~/features/feed/rssFeeds'

/** 部署站点地址的源；本地开发或站点地址缺失时只认浏览器当前域名 */
function siteOrigin(siteUrl: string): string | null {
  try {
    return new URL(siteUrl).origin
  } catch {
    return null
  }
}

export default defineNuxtPlugin(() => {
  const { openFeed } = useRssSubscribe()
  const configured = siteOrigin(useSiteUrl())

  document.addEventListener('click', (event) => {
    if (window.location.pathname.startsWith('/admin')) return
    const origins = configured ? [window.location.origin, configured] : [window.location.origin]
    const key = feedKeyFromClick(event, window.location.href, origins)
    if (!key) return
    event.preventDefault()
    openFeed(key)
  })
})
