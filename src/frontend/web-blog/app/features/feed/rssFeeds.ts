/**
 * @file rssFeeds.ts
 * @description 公开 RSS 订阅源清单、完整订阅地址与第三方阅读器添加链接的纯逻辑；订阅弹窗与 RSS 入口共用
 * @author TixXin
 * @since 2026-11-05
 */

/** 订阅源标识 */
export type RssFeedKey = 'posts' | 'flash' | 'moments'

export interface RssFeedFormat {
  /** 格式名称，属于标准名不翻译 */
  label: string
  path: string
}

export interface RssFeed {
  key: RssFeedKey
  /** 服务端（静态形态为构建产物）输出的订阅文件路径 */
  path: string
  /** 订阅源名称的文案键 */
  labelKey: string
  /** 同一内容的其他订阅格式 */
  formats: RssFeedFormat[]
}

export const RSS_FEEDS: readonly RssFeed[] = [
  {
    key: 'posts',
    path: '/rss.xml',
    labelKey: 'article.rss.posts',
    formats: [
      { label: 'Atom', path: '/atom.xml' },
      { label: 'JSON Feed', path: '/feed.json' },
    ],
  },
  { key: 'flash', path: '/flash.xml', labelKey: 'article.rss.flash', formats: [] },
  { key: 'moments', path: '/moments.xml', labelKey: 'article.rss.moments', formats: [] },
]

/** 按标识取订阅源，未知标识回落到文章订阅 */
export function rssFeedByKey(key: RssFeedKey): RssFeed {
  return RSS_FEEDS.find((feed) => feed.key === key) ?? RSS_FEEDS[0]!
}

/** 由入口链接地址反查订阅源；不是已知订阅文件时返回 null，入口保持原生跳转 */
export function feedKeyFromHref(href: string): RssFeedKey | null {
  const path = href.split(/[?#]/)[0]
  return RSS_FEEDS.find((feed) => feed.path === path)?.key ?? null
}

/** 拼出阅读器可直接使用的完整订阅地址；站点地址缺失时退回浏览器当前域名 */
export function feedAbsoluteUrl(siteUrl: string, path: string, fallbackOrigin = ''): string {
  const base = (siteUrl || fallbackOrigin).replace(/\/+$/, '')
  return `${base}${path}`
}

export interface RssReaderLink {
  name: string
  url: string
}

/** 第三方阅读器的添加订阅链接：只是跳转地址，本站服务器不向它们发起请求 */
export function readerSubscribeLinks(feedUrl: string): RssReaderLink[] {
  const encoded = encodeURIComponent(feedUrl)
  return [
    { name: 'Inoreader', url: `https://www.inoreader.com/?add_feed=${encoded}` },
    { name: 'Feedly', url: `https://feedly.com/i/subscription/feed/${encoded}` },
  ]
}
