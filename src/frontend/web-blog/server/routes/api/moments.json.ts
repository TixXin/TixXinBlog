/**
 * @file moments.json.ts
 * @description 朋友圈公开 JSON 订阅，使用真实最新动态和站点设置，不输出访客身份或评论
 */
import { publicMoments, publicSiteSettings, publicSiteUrl, publicFeedUrl } from '../../utils/publicContent'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'access-control-allow-origin', '*')
  setResponseHeader(event, 'access-control-allow-methods', 'GET, HEAD')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [items, settings] = await Promise.all([publicMoments(event), publicSiteSettings(event)])
  const moments = items.map((moment) => ({
    id: moment.id,
    url: `${site}/moments/${encodeURIComponent(moment.id)}`,
    content: moment.content,
    date: moment.date,
    likes: moment.likes,
    topics: moment.topics ?? [],
    images: (moment.images ?? []).map((image) => publicFeedUrl(image, site)).filter((image) => image !== undefined),
    location: moment.location,
    isPinned: !!moment.isPinned,
    mood: moment.mood,
    linkedArticle:
      moment.linkedArticle && publicFeedUrl(moment.linkedArticle.url, site)
        ? { title: moment.linkedArticle.title, url: publicFeedUrl(moment.linkedArticle.url, site) }
        : null,
    linkedLink:
      moment.linkedLink && publicFeedUrl(moment.linkedLink.url, site)
        ? { title: moment.linkedLink.title, url: publicFeedUrl(moment.linkedLink.url, site) }
        : null,
  }))
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  return {
    site: { name: settings.name, url: site },
    generatedAt: new Date().toISOString(),
    count: moments.length,
    moments,
  }
})
