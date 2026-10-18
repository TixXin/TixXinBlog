/**
 * @file flash.xml.ts
 * @description 闪念 RSS 仅使用当前公开数据，草稿/归档项过滤且不拼接未转义 CDATA
 */
import {
  escapeXml,
  latestDate,
  publicFlashes,
  publicSiteSettings,
  publicSiteUrl,
  sendFeed,
} from '../utils/publicContent'

/** 标题按字符截断，超出时补省略号 */
function feedTitle(content: string, max = 60) {
  const characters = Array.from(content.replace(/\s+/g, ' ').trim())
  return characters.length > max ? `${characters.slice(0, max).join('')}…` : characters.join('')
}

export default defineEventHandler(async (event) => {
  // 失败响应不缓存；成功时由 sendFeed 改为短期缓存
  setResponseHeader(event, 'cache-control', 'no-store')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [notes, settings] = await Promise.all([publicFlashes(event), publicSiteSettings(event)])
  const creator = settings.ownerName || settings.name
  const entries = notes
    .map((note) => {
      const link = `${site}/flash/${encodeURIComponent(note.id)}`
      const categories = (note.tags ?? []).map((tag) => `<category>${escapeXml(tag)}</category>`).join('')
      // 闪念是纯文本；XML 解码后的描述仍须安全，不能让阅读器把原文当成 HTML 标签。
      const description = escapeXml(note.content)
      return `<item><title>${escapeXml(feedTitle(note.content))}</title>
<link>${escapeXml(link)}</link><guid isPermaLink="true">${escapeXml(link)}</guid>
<description>${escapeXml(description)}</description><pubDate>${new Date(note.createdAt).toUTCString()}</pubDate>
<dc:creator>${escapeXml(creator)}</dc:creator>${categories}</item>`
    })
    .join('\n')
  const updated = latestDate([settings.updatedAt, ...notes.map((note) => note.updatedAt || note.createdAt)])
  return sendFeed(
    event,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${escapeXml(settings.name)} 闪念</title><link>${escapeXml(site + '/flash')}</link>
<description>公开的灵感碎片</description><language>zh-CN</language>
<lastBuildDate>${updated.toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(site + '/flash.xml')}" rel="self" type="application/rss+xml" />
${entries}
</channel></rss>`,
    updated,
  )
})
