/**
 * @file useRssSubscribe.ts
 * @description RSS 订阅弹窗的全局开关与当前订阅源；页面各处 RSS 入口共用同一个弹窗
 * @author TixXin
 * @since 2026-11-05
 */
import type { RssFeedKey } from '~/features/feed/rssFeeds'

export function useRssSubscribe() {
  const visible = useState('rss-subscribe-visible', () => false)
  const feedKey = useState<RssFeedKey>('rss-subscribe-feed', () => 'posts')

  function openFeed(key: RssFeedKey) {
    feedKey.value = key
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { visible, feedKey, openFeed, close }
}
