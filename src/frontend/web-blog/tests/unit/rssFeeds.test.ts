/** @file rssFeeds.test.ts @description RSS 订阅源清单、地址拼接与阅读器添加链接的纯逻辑回归。 */
import { describe, expect, it } from 'vitest'
import {
  RSS_FEEDS,
  feedAbsoluteUrl,
  feedKeyFromHref,
  readerSubscribeLinks,
  rssFeedByKey,
} from '../../app/features/feed/rssFeeds'

describe('RSS 订阅源', () => {
  it('三个订阅源对应服务端输出的订阅文件，文章源附带 Atom 与 JSON Feed', () => {
    expect(RSS_FEEDS.map((feed) => [feed.key, feed.path])).toEqual([
      ['posts', '/rss.xml'],
      ['flash', '/flash.xml'],
      ['moments', '/moments.xml'],
    ])
    expect(rssFeedByKey('posts').formats.map((format) => format.path)).toEqual(['/atom.xml', '/feed.json'])
    expect(rssFeedByKey('moments').formats).toEqual([])
  })

  it('由入口地址反查订阅源，忽略查询与锚点，未知地址不接管', () => {
    expect(feedKeyFromHref('/rss.xml')).toBe('posts')
    expect(feedKeyFromHref('/flash.xml?utm=1')).toBe('flash')
    expect(feedKeyFromHref('/moments.xml#top')).toBe('moments')
    expect(feedKeyFromHref('/atom.xml')).toBeNull()
    expect(feedKeyFromHref('https://example.com/rss.xml')).toBeNull()
  })

  it('完整订阅地址去掉多余斜杠，站点地址缺失时用当前域名', () => {
    expect(feedAbsoluteUrl('https://blog.example.com/', '/rss.xml')).toBe('https://blog.example.com/rss.xml')
    expect(feedAbsoluteUrl('', '/flash.xml', 'http://localhost:3000')).toBe('http://localhost:3000/flash.xml')
  })

  it('阅读器链接对订阅地址整体编码', () => {
    const links = readerSubscribeLinks('https://blog.example.com/rss.xml?a=1&b=2')
    const encoded = encodeURIComponent('https://blog.example.com/rss.xml?a=1&b=2')
    expect(links).toEqual([
      { name: 'Inoreader', url: `https://www.inoreader.com/?add_feed=${encoded}` },
      { name: 'Feedly', url: `https://feedly.com/i/subscription/feed/${encoded}` },
    ])
  })
})
