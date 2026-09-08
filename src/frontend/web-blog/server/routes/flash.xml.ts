/**
 * @file flash.xml.ts
 * @description 闪念 RSS 仅使用当前公开数据，草稿/归档项过滤且不拼接未转义 CDATA
 */
import { escapeXml, publicFlashes, publicSiteUrl, publicSiteSettings } from '../utils/publicContent'

export default defineEventHandler(async (event) => {
  const site = publicSiteUrl(event)
  const [notes, settings] = await Promise.all([publicFlashes(event), publicSiteSettings(event)])
  const entries = notes
    .map(
      (note) => `<item><title>${escapeXml(note.content.replace(/\s+/g, ' ').slice(0, 60))}</title>
<link>${site}/flash/${encodeURIComponent(note.id)}</link><guid>${site}/flash/${encodeURIComponent(note.id)}</guid>
<description>${escapeXml(note.content)}</description><pubDate>${new Date(note.createdAt).toUTCString()}</pubDate></item>`,
    )
    .join('\n')
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-store')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<title>${escapeXml(settings.name)} 闪念</title><link>${site}/flash</link><description>公开的灵感碎片</description>${entries}</channel></rss>`
})
