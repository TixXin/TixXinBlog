/**
 * @file moments.xml.ts
 * @description 朋友圈 RSS 2.0 feed，当前基于 mock，后端就绪后改为 API 调用
 * @author TixXin
 * @since 2026-04-17
 */

import { mockMoments } from '~/features/moment/mock'

export default defineEventHandler((event) => {
  const siteUrl = 'https://tix.xin'
  const siteName = 'TixXin 朋友圈'
  const siteDescription = '记录生活点滴、分享日常碎片与技术灵感'

  const moments = mockMoments
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // 闪念可能没有标题：用 content 前 40 字符作为标题
  const deriveTitle = (content: string) => {
    const oneLine = content.replace(/\s+/g, ' ').trim()
    return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
  }

  const items = moments
    .map((m) => {
      const title = deriveTitle(m.content)
      const link = `${siteUrl}/moments/${m.id}`
      const categories = (m.topics ?? []).map((t) => `      <category>${escapeXml(t)}</category>`).join('\n')
      const firstImage = m.images?.[0]
      const enclosure = firstImage
        ? `      <enclosure url="${escapeXml(firstImage)}" type="image/jpeg" length="0" />`
        : ''

      // description 使用 CDATA 保护原文，便于阅读器直接呈现（含换行）
      const descCdata = `<![CDATA[${m.content}${firstImage ? `\n\n<p><img src="${firstImage}" alt="" /></p>` : ''}]]>`

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${descCdata}</description>
      <pubDate>${new Date(m.date).toUTCString()}</pubDate>
${categories}${categories ? '\n' : ''}${enclosure}${enclosure ? '\n' : ''}    </item>`
    })
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}/moments</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/moments.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return rss
})
