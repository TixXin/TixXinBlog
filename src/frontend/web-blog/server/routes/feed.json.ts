/**
 * @file feed.json.ts
 * @description 文章 JSON Feed 1.1，复用 RSS 的公开数据与缓存，全文不可用时提供纯文本摘要
 */
import { publicArticleFeed, publicFeedUrl, sendFeed } from '../utils/publicContent'

export default defineEventHandler(async (event) => {
  const { site, settings, creator, entries, updated } = await publicArticleFeed(event)
  return sendFeed(
    event,
    JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: settings.name,
      home_page_url: site + '/',
      feed_url: site + '/feed.json',
      description: settings.description,
      language: 'zh-CN',
      authors: [{ name: creator }],
      items: entries.map(({ post, id, url, html, published, modified }) => ({
        id,
        url,
        title: post.title,
        summary: post.summary,
        ...(html ? { content_html: html } : { content_text: post.summary }),
        image: publicFeedUrl(post.cover, site),
        date_published: published,
        date_modified: modified,
        tags: [post.folder, ...(post.tags ?? []).map((tag) => tag.label)],
      })),
    }),
    updated,
    'application/feed+json',
  )
})
