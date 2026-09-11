/**
 * @file moments.xml.ts
 * @description 朋友圈 RSS 仅发布真实公开动态，使用运行时站点地址并及时反映撤回
 */
import { escapeXml, publicMoments, publicSiteSettings, publicSiteUrl, publicFeedUrl } from '../utils/publicContent'

const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [moments, settings] = await Promise.all([publicMoments(event), publicSiteSettings(event)])
  const items = moments
    .map((moment) => {
      const oneLine = moment.content.replace(/\s+/g, ' ').trim()
      const title = oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
      const link = `${site}/moments/${encodeURIComponent(moment.id)}`
      const image = publicFeedUrl(moment.images?.[0], site)
      const imageType = image ? imageTypes[new URL(image).pathname.split('.').at(-1)!.toLowerCase()] : undefined
      const enclosure =
        image && imageType ? `<enclosure url="${escapeXml(image)}" type="${imageType}" length="0" />` : ''
      // 先把正文转为安全 HTML，再整体转义为 XML 文本，避免 CDATA 终止符和阅读器 HTML 注入。
      const description =
        escapeXml(moment.content).replace(/\r?\n/g, '<br />') +
        (image ? `<p><img src="${escapeXml(image)}" alt="" /></p>` : '')
      const categories = (moment.topics ?? []).map((topic) => `<category>${escapeXml(topic)}</category>`).join('')
      return `<item><title>${escapeXml(title)}</title>
<link>${escapeXml(link)}</link><guid isPermaLink="true">${escapeXml(link)}</guid>
<description>${escapeXml(description)}</description><pubDate>${new Date(moment.date).toUTCString()}</pubDate>
${categories}${enclosure}</item>`
    })
    .join('\n')
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escapeXml(settings.name)} 朋友圈</title><link>${escapeXml(site + '/moments')}</link>
<description>${escapeXml(settings.description)}</description><language>zh-CN</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(site + '/moments.xml')}" rel="self" type="application/rss+xml" />
${items}
</channel></rss>`
})
