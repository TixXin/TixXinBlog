/**
 * @file rss.xml.ts
 * @description 文章 RSS 由当前公开数据库文章生成，撤回内容不再继续出现在订阅中；正文以 content:encoded 输出全文
 */
import {
  escapeXml,
  latestDate,
  mapLimit,
  publicArticleFeedHtml,
  publicPosts,
  publicSiteSettings,
  publicSiteUrl,
  sendFeed,
} from '../utils/publicContent'
import { articlePath } from '~/utils/articlePath'

export default defineEventHandler(async (event) => {
  // 失败响应不缓存；成功时由 sendFeed 改为短期缓存
  setResponseHeader(event, 'cache-control', 'no-store')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [{ items }, settings] = await Promise.all([publicPosts(event), publicSiteSettings(event)])
  const creator = settings.ownerName || settings.name
  const bodies = await mapLimit(items, 4, (post) =>
    publicArticleFeedHtml(event, String(post.id), `${site}${articlePath(post)}`),
  )
  const entries = items
    .map((post, index) => {
      const link = `${site}${articlePath(post)}`
      // 全文先渲染为安全 HTML，再整体转义为 XML 文本，不使用 CDATA，避免终止符注入
      const content = bodies[index] ? `<content:encoded>${escapeXml(bodies[index])}</content:encoded>` : ''
      const tags = (post.tags ?? []).map((tag) => `<category>${escapeXml(tag.label)}</category>`).join('')
      return `<item><title>${escapeXml(post.title)}</title>
<link>${escapeXml(link)}</link><guid>${escapeXml(`${site}/articles/${post.id}`)}</guid>
<description>${escapeXml(post.summary)}</description>${content}
<pubDate>${new Date(post.date).toUTCString()}</pubDate><dc:creator>${escapeXml(creator)}</dc:creator>
<category>${escapeXml(post.folder)}</category>${tags}</item>`
    })
    .join('\n')
  const updated = latestDate([settings.updatedAt, ...items.map((post) => post.date)])
  return sendFeed(
    event,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${escapeXml(settings.name)}</title><link>${escapeXml(site + '/')}</link>
<description>${escapeXml(settings.description)}</description><language>zh-CN</language>
<lastBuildDate>${updated.toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(site + '/rss.xml')}" rel="self" type="application/rss+xml" />
${entries}
</channel></rss>`,
    updated,
  )
})
