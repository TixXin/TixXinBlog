/**
 * @file publicContent.ts
 * @description 订阅和站点地图共用的公开 API 数据源，不读取客户端 Mock 或私人 Cookie
 */
import type { H3Event } from 'h3'
import type { PostMetadata, PostPage } from '~/features/post/types'
import type { FlashNote } from '~/features/flash/types'
import type { MomentItem, MomentPage } from '~/features/moment/types'
import type { SiteSettingsData } from '~/features/site/settings'

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
