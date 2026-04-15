/**
 * @file favicon.ts
 * @description 书签 favicon 抓取工具：构建 provider URL + 异步校验可达性
 * @author TixXin
 * @since 2026-04-15
 *
 * 三个 provider 各有取舍：
 * - google: 覆盖最广，国内访问偶尔抽风
 * - duckduckgo: 国内较稳，覆盖略少
 * - icon-horse: 服务稳定，但需要完整域名
 */

import type { FaviconProvider } from '~/composables/useTabSettings'

/** 从 URL 提取主机名，失败返回 null */
export function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** 按 provider 构建 favicon URL */
export function buildFaviconUrl(host: string, provider: FaviconProvider = 'google'): string {
  switch (provider) {
    case 'duckduckgo':
      return `https://icons.duckduckgo.com/ip3/${host}.ico`
    case 'icon-horse':
      return `https://icon.horse/icon/${host}`
    case 'google':
    default:
      return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  }
}

/**
 * 异步抓取并校验 favicon 可达性。
 * 用 Image 对象 onload/onerror 验证，避免写入死链。
 * 超过 5 秒超时按失败处理，防止 UI 长时间等待。
 */
export function fetchFavicon(url: string, provider: FaviconProvider = 'google'): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const host = extractHost(url)
  if (!host) return Promise.resolve(null)
  const faviconUrl = buildFaviconUrl(host, provider)
  return new Promise((resolve) => {
    const img = new Image()
    const timer = window.setTimeout(() => {
      img.src = ''
      resolve(null)
    }, 5000)
    img.onload = () => {
      window.clearTimeout(timer)
      // Google s2 即便抓不到也会返回 16px 占位图，此处通过尺寸粗略过滤
      if (provider === 'google' && img.naturalWidth <= 16 && img.naturalHeight <= 16) {
        resolve(null)
      } else {
        resolve(faviconUrl)
      }
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = faviconUrl
  })
}
