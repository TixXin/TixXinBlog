/**
 * @file atom.xml.ts
 * @description 文章 Atom 1.0 订阅，复用 RSS 的公开数据、全文渲染与条件请求
 */
import { escapeXml, publicArticleFeed, sendFeed } from '../utils/publicContent'

export default defineEventHandler(async (event) => {
  const { site, settings, creator, entries, updated } = await publicArticleFeed(event)
  const items = entries
    .map(({ post, id, url, html, published, updated }) => {
      const content = html ? `<content type="html">${escapeXml(html)}</content>` : ''
      const categories = [post.folder, ...(post.tags ?? []).map((tag) => tag.label)]
        .map((category) => `<category term="${escapeXml(category)}" />`)
        .join('')
      return `<entry><id>${escapeXml(id)}</id><title>${escapeXml(post.title)}</title>
<link rel="alternate" type="text/html" href="${escapeXml(url)}" />
<published>${published}</published><updated>${updated}</updated>
<summary>${escapeXml(post.summary)}</summary>${content}${categories}</entry>`
    })
    .join('\n')
  return sendFeed(
    event,
    `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
<id>${escapeXml(site + '/')}</id><title>${escapeXml(settings.name)}</title>
<subtitle>${escapeXml(settings.description)}</subtitle><updated>${updated.toISOString()}</updated>
<link rel="alternate" type="text/html" href="${escapeXml(site + '/')}" />
<link rel="self" type="application/atom+xml" href="${escapeXml(site + '/atom.xml')}" />
<author><name>${escapeXml(creator)}</name></author>
${items}
</feed>`,
    updated,
    'application/atom+xml',
  )
})
