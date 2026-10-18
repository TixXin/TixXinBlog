/**
 * @file rss.xml.ts
 * @description 文章 RSS 由当前公开数据库文章生成，撤回内容不再继续出现在订阅中；正文以 content:encoded 输出全文
 */
import { escapeXml, publicArticleFeed, sendFeed } from '../utils/publicContent'

export default defineEventHandler(async (event) => {
  const { site, settings, creator, entries, updated } = await publicArticleFeed(event)
  const items = entries
    .map(({ post, id, url, html, published }) => {
      // 全文先渲染为安全 HTML，再整体转义为 XML 文本，不使用 CDATA，避免终止符注入
      const content = html ? `<content:encoded>${escapeXml(html)}</content:encoded>` : ''
      const tags = (post.tags ?? []).map((tag) => `<category>${escapeXml(tag.label)}</category>`).join('')
      // 阅读器解开 XML 后会按 HTML 展示摘要，先转义纯文本，避免重新产生可执行标签。
      const description = escapeXml(post.summary)
      return `<item><title>${escapeXml(post.title)}</title>
<link>${escapeXml(url)}</link><guid>${escapeXml(id)}</guid>
<description>${escapeXml(description)}</description>${content}
<pubDate>${new Date(published).toUTCString()}</pubDate><dc:creator>${escapeXml(creator)}</dc:creator>
<category>${escapeXml(post.folder)}</category>${tags}</item>`
    })
    .join('\n')
  return sendFeed(
    event,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${escapeXml(settings.name)}</title><link>${escapeXml(site + '/')}</link>
<description>${escapeXml(settings.description)}</description><language>zh-CN</language>
<lastBuildDate>${updated.toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(site + '/rss.xml')}" rel="self" type="application/rss+xml" />
${items}
</channel></rss>`,
    updated,
  )
})
