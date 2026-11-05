/** @file rssFeeds.test.ts @description RSS 订阅源清单、地址拼接与阅读器添加链接的纯逻辑回归。 */
import { describe, expect, it } from 'vitest'
import {
  RSS_FEEDS,
  feedAbsoluteUrl,
  feedKeyFromClick,
  feedKeyFromHref,
  feedKeyFromLink,
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

  it('本站相对地址或站点完整地址都识别为订阅链接，站外与非法地址不识别', () => {
    const origins = ['http://localhost:3000', 'https://blog.example.com']
    const base = 'http://localhost:3000/flash'
    expect(feedKeyFromLink('/moments.xml', base, origins)).toBe('moments')
    expect(feedKeyFromLink('rss.xml', 'http://localhost:3000/', origins)).toBe('posts')
    expect(feedKeyFromLink('https://blog.example.com/flash.xml', base, origins)).toBe('flash')
    expect(feedKeyFromLink('https://other.example.com/rss.xml', base, origins)).toBeNull()
    expect(feedKeyFromLink('/about', base, origins)).toBeNull()
    expect(feedKeyFromLink('http://[bad', base, origins)).toBeNull()
  })

  it('只接管无修饰键的左键点击，跳过下载链接与原生标记区域', () => {
    const origins = [window.location.origin]
    const base = window.location.href
    document.body.innerHTML = `
      <a id="feed" href="/rss.xml"><span id="inner">RSS</span></a>
      <a id="download" href="/rss.xml" download>RSS</a>
      <div data-rss-native><a id="native" href="/flash.xml">XML</a></div>
      <button id="plain">按钮</button>`
    const clickOn = (id: string, init: MouseEventInit = {}) => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
      Object.defineProperty(event, 'target', { value: document.getElementById(id) })
      return feedKeyFromClick(event, base, origins)
    }
    expect(clickOn('inner')).toBe('posts')
    expect(clickOn('feed', { metaKey: true })).toBeNull()
    expect(clickOn('feed', { button: 1 })).toBeNull()
    expect(clickOn('download')).toBeNull()
    expect(clickOn('native')).toBeNull()
    expect(clickOn('plain')).toBeNull()
    const prevented = new MouseEvent('click', { cancelable: true, button: 0 })
    prevented.preventDefault()
    Object.defineProperty(prevented, 'target', { value: document.getElementById('feed') })
    expect(feedKeyFromClick(prevented, base, origins)).toBeNull()
    document.body.innerHTML = ''
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
