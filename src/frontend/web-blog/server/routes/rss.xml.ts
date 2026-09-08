/**
 * @file rss.xml.ts
 * @description 文章 RSS 由当前公开数据库文章生成，撤回内容不再继续出现在订阅中
 */
import { escapeXml, publicPosts, publicSiteUrl, publicSiteSettings } from '../utils/publicContent'
import { articlePath } from '~/utils/articlePath'

export default defineEventHandler(async (event) => {
  const site = publicSiteUrl(event)
  const [{ items }, settings] = await Promise.all([publicPosts(event), publicSiteSettings(event)])
  const entries = items
    .map(
      (post) => `<item><title>${escapeXml(post.title)}</title>
<link>${site}${articlePath(post)}</link><guid>${site}/articles/${post.id}</guid>
<description>${escapeXml(post.summary)}</description><pubDate>${new Date(post.date).toUTCString()}</pubDate>
<category>${escapeXml(post.folder)}</category></item>`,
    )
    .join('\n')
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-store')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<title>${escapeXml(settings.name)}</title><link>${site}</link><description>${escapeXml(settings.description)}</description>
<language>zh-CN</language>${entries}</channel></rss>`
})
