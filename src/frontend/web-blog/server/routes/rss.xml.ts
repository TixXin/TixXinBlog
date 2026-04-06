/**
 * @file rss.xml.ts
 * @description RSS 2.0 feed 生成，当前基于 mock 数据，后端就绪后改为 API 调用
 * @author TixXin
 * @since 2026-04-06
 */

import { mockPosts } from '~/features/post/mock'

export default defineEventHandler((event) => {
  const siteUrl = 'https://tix.xin'
  const siteName = 'TixXin Blog'
  const siteDescription = 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔'

  const posts = mockPosts
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/articles/${post.id}</link>
      <guid>${siteUrl}/articles/${post.id}</guid>
      <description>${escapeXml(post.summary)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
    </item>`,
    )
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return rss
})
