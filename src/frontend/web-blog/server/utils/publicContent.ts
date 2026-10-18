/**
 * @file publicContent.ts
 * @description 订阅和站点地图共用的公开 API 数据源，不读取客户端 Mock 或私人 Cookie
 */
import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ArticleDetail, PostMetadata, PostPage } from '~/features/post/types'
import { renderArticleMarkdown } from '~/utils/articleMarkdown'
import type { FlashNote } from '~/features/flash/types'
import type { MomentItem, MomentPage } from '~/features/moment/types'
import type { SiteSettingsData } from '~/features/site/settings'
import { articlePath } from '~/utils/articlePath'

export async function publicApi<T>(event: H3Event, path: string): Promise<T> {
  const base = String(useRuntimeConfig(event).apiBaseUrl).replace(/\/$/, '')
  if (!/^https?:\/\//.test(base)) throw createError({ statusCode: 503, message: '公开内容服务尚未配置' })
  try {
    const response = await $fetch<{ code: number; data: T }>(`${base}${path}`, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      timeout: 10000,
      retry: 0,
    })
    if (response.code !== 0) throw new Error('upstream')
    return response.data
  } catch {
    throw createError({ statusCode: 503, message: '公开内容暂时无法加载' })
  }
}

export const publicPosts = (event: H3Event) => publicApi<PostPage>(event, '/posts?pageSize=20&pinnedFirst=false')
export const publicSiteSettings = (event: H3Event) => publicApi<SiteSettingsData>(event, '/site')
export const publicMetadata = (event: H3Event) => publicApi<PostMetadata>(event, '/posts/metadata')
export async function publicFlashes(event: H3Event): Promise<FlashNote[]> {
  const data = await publicApi<{ items: FlashNote[] }>(event, '/flashes?pageSize=30')
  return data.items.filter((note) => !note.isDraft && !note.isArchived)
}

export async function publicMoments(event: H3Event): Promise<MomentItem[]> {
  const data = await publicApi<MomentPage>(event, '/moments?pageSize=30&pinnedFirst=false')
  // 公开接口本身过滤状态；额外拒绝意外返回的私有状态，排序与分页由后端稳定完成。
  return data.items
    .filter((note) => (!('status' in note) || note.status === 'published') && !('deletedAt' in note && note.deletedAt))
    .slice(0, 30)
}

/** 站点地图分页读取的上限：每类最多 maxPages 页，避免单次生成拖垮上游 */
export async function publicPagedItems<T>(event: H3Event, path: string, pageSize: number, maxPages = 20): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?'
    const data = await publicApi<{ items: T[]; total: number }>(
      event,
      `${path}${separator}page=${page}&pageSize=${pageSize}`,
    )
    items.push(...data.items)
    if (data.items.length < pageSize || items.length >= data.total) break
  }
  return items
}

/** 全文与内容修订时间共用 10 分钟缓存；键位于 cache:nitro 前缀下，内容写请求会随 SSR 缓存一并清空 */
const cachedArticleFeedContent = defineCachedFunction(
  async (event: H3Event, id: string) => {
    const detail = await publicApi<ArticleDetail>(event, `/posts/${encodeURIComponent(id)}`)
    return {
      html: detail.contentRaw ? renderArticleMarkdown(detail.contentRaw, detail.title) : '',
      updatedAt: detail.updatedAt,
    }
  },
  { name: 'feed-article-content', maxAge: 600, getKey: (_event: H3Event, id: string) => id },
)

/** 读取文章全文并把站内相对地址改为文章绝对地址；读取或渲染失败返回 undefined，由订阅回退为摘要 */
export async function publicArticleFeedContent(event: H3Event, id: string, articleUrl: string) {
  try {
    const content = await cachedArticleFeedContent(event, id)
    return { html: absolutizeHtml(content.html, articleUrl), updatedAt: content.updatedAt }
  } catch {
    return undefined
  }
}

/** 三种文章订阅共用公开列表、稳定标识、绝对地址与全文读取；详情失败时保留摘要和发布时间 */
export async function publicArticleFeed(event: H3Event) {
  // 列表与站点读取失败不缓存；成功时由 sendFeed 改为短期缓存。
  setResponseHeader(event, 'cache-control', 'no-store')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [{ items }, settings] = await Promise.all([publicPosts(event), publicSiteSettings(event)])
  const entries = await mapLimit(items, 4, async (post) => {
    const url = `${site}${articlePath(post)}`
    const content = await publicArticleFeedContent(event, String(post.id), url)
    const published = latestDate([post.date]).toISOString()
    const modified = content?.updatedAt ? latestDate([post.date, content.updatedAt]).toISOString() : undefined
    return {
      post,
      // 标识与 slug 解耦，文章改名后阅读器仍识别为同一条目。
      id: `${site}/articles/${post.id}`,
      url,
      html: content?.html ?? '',
      published,
      modified,
      updated: modified ?? published,
    }
  })
  return {
    site,
    settings,
    creator: settings.ownerName || settings.name,
    entries,
    updated: latestDate([settings.updatedAt, ...entries.map((entry) => entry.updated)]),
  }
}

/** 订阅阅读器不知道页面地址，src/href/srcset 需相对文章地址解析；非 http(s) 地址保持原样 */
export function absolutizeHtml(html: string, base: string): string {
  const absoluteUrl = (value: string) => {
    const raw = value.replace(/&amp;/g, '&')
    try {
      const url = new URL(raw, base)
      if (!['http:', 'https:'].includes(url.protocol)) return value
      return url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    } catch {
      return value
    }
  }
  return html.replace(/(\s(?:src|href|srcset))="([^"]*)"/g, (_match, attribute: string, value: string) => {
    if (attribute.trim() !== 'srcset') return `${attribute}="${absoluteUrl(value)}"`

    // srcset 的 URL 内可含逗号（如 data URI），按 URL 和描述符逐项读取，不能直接 split(',')。
    let remaining = value
    let result = ''
    while (remaining) {
      const prefix = remaining.match(/^[\s,]*/)![0]
      result += prefix
      remaining = remaining.slice(prefix.length)
      if (!remaining) break
      const token = remaining.match(/^\S+/)![0]
      const url = token.replace(/,+$/, '')
      result += absoluteUrl(url) + token.slice(url.length)
      remaining = remaining.slice(token.length)
      if (url === token) {
        // 宽度或密度描述符保持原样，逗号之后才开始下一候选地址。
        const descriptor = remaining.match(/^[^,]*(?:,|$)/)![0]
        result += descriptor
        remaining = remaining.slice(descriptor.length)
      }
    }
    return `${attribute}="${result}"`
  })
}

/** 并发受限的映射，避免订阅生成时同时打满上游 */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await task(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** 订阅内容中最新的时间点，作为 lastBuildDate 与 Last-Modified；同样内容生成同样正文，ETag 才稳定 */
export function latestDate(values: (string | undefined | null)[]): Date {
  const times = values.map((value) => (value ? Date.parse(value) : NaN)).filter((time) => Number.isFinite(time))
  return new Date(times.length ? Math.max(...times) : 0)
}

/**
 * 订阅响应：短期 HTTP 缓存（5 分钟）+ ETag/Last-Modified 条件请求。
 * 服务端不缓存整份订阅，撤回与上游故障在下一次请求即反映；失败响应由调用方预先设置的 no-store 保持不缓存。
 */
export function sendFeed(
  event: H3Event,
  body: string,
  lastModified: Date,
  contentType = 'application/rss+xml',
): string {
  const etag = `W/"${createHash('sha1').update(body).digest('base64url')}"`
  setResponseHeaders(event, {
    'content-type': `${contentType}; charset=utf-8`,
    'cache-control': 'public, max-age=300',
    etag,
    'last-modified': lastModified.toUTCString(),
  })
  const ifNoneMatch = getRequestHeader(event, 'if-none-match')
  const ifModifiedSince = getRequestHeader(event, 'if-modified-since')
  const strip = (tag: string) => tag.trim().replace(/^W\//, '')
  // If-None-Match 优先；只有缺失时才比较 If-Modified-Since（RFC 9110）
  const notModified = ifNoneMatch
    ? ifNoneMatch.split(',').some((tag) => tag.trim() === '*' || strip(tag) === strip(etag))
    : Boolean(ifModifiedSince) &&
      Math.floor(lastModified.getTime() / 1000) <= Math.floor(Date.parse(ifModifiedSince!) / 1000)
  if (notModified) {
    setResponseStatus(event, 304)
    return ''
  }
  return body
}

export function publicFeedUrl(value: string | undefined, site: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, site + '/')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

export function escapeXml(value: string): string {
  // XML 1.0 不允许多数控制字符和孤立代理项；按码点处理，保留正常的中文与扩展字符。
  return Array.from(value)
    .filter((character) => {
      const point = character.codePointAt(0)!
      return (
        point === 9 ||
        point === 10 ||
        point === 13 ||
        (point >= 0x20 && point <= 0xd7ff) ||
        (point >= 0xe000 && point <= 0xfffd) ||
        (point >= 0x10000 && point <= 0x10ffff)
      )
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function publicSiteUrl(event: H3Event): string {
  return String(useRuntimeConfig(event).public.siteUrl).replace(/\/$/, '')
}
