/**
 * @file flash.xml.ts
 * @description 闪念 RSS 2.0 feed，数据源当前为公开 seed（博主已发的公开闪念）
 * @author TixXin
 * @since 2026-04-17
 *
 * 由于 server 端无法访问客户端 localStorage（LocalFlashRepository 的数据位置），
 * RSS 直接消费 `defaultFlashNoteSeeds`（每条带稳定 id + createdAt）。
 * 后端就绪后替换为 $fetch /api/flash-notes?userId=owner。
 */

import { defaultFlashNoteSeeds } from '~/features/flash/mock'

export default defineEventHandler((event) => {
  const siteUrl = 'https://tix.xin'
  const siteName = 'TixXin 闪念'
  const siteDescription = '记录每一个稍纵即逝的灵感，配合 AI 搜索回顾想法历史'

  const notes = defaultFlashNoteSeeds
    .slice()
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 30)

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const deriveTitle = (content: string) => {
    const oneLine = content.replace(/\s+/g, ' ').trim()
    return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
  }

  const items = notes
    .map((n) => {
      const title = deriveTitle(n.content)
      const link = `${siteUrl}/flash/${n.id}`
      const categories = (n.tags ?? []).map((t) => `      <category>${escapeXml(t)}</category>`).join('\n')
      const descCdata = `<![CDATA[${n.content}]]>`

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${descCdata}</description>
      <pubDate>${new Date(n.createdAt ?? Date.now()).toUTCString()}</pubDate>
${categories}${categories ? '\n' : ''}    </item>`
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}/flash</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/flash.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return rss
})
