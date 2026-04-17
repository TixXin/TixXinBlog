/**
 * @file moments.json.ts
 * @description 闪念公开 JSON API，便于第三方聚合 / 静态站抓取
 * @author TixXin
 * @since 2026-04-17
 */

import { mockMoments } from '~/features/moment/mock'

const SITE_URL = 'https://tix.xin'

export default defineEventHandler((event) => {
  const moments = mockMoments
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((m) => ({
      id: m.id,
      url: `${SITE_URL}/moments/${m.id}`,
      content: m.content,
      date: m.date,
      likes: m.likes,
      topics: m.topics ?? [],
      images: m.images ?? [],
      location: m.location,
      isPinned: !!m.isPinned,
      mood: m.mood,
      linkedArticle: m.linkedArticle ? { title: m.linkedArticle.title, url: m.linkedArticle.url } : null,
      linkedLink: m.linkedLink ? { title: m.linkedLink.title, url: m.linkedLink.url } : null,
    }))

  // 跨域只读公开数据，开放 GET CORS
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'cache-control', 'public, max-age=300')

  return {
    site: { name: 'TixXin Blog', url: SITE_URL },
    generatedAt: new Date().toISOString(),
    count: moments.length,
    moments,
  }
})
