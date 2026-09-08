/**
 * @file publicContent.ts
 * @description 订阅和站点地图共用的公开 API 数据源，不读取客户端 Mock 或私人 Cookie
 */
import type { H3Event } from 'h3'
import type { PostMetadata, PostPage } from '~/features/post/types'
import type { FlashNote } from '~/features/flash/types'
import type { SiteSettingsData } from '~/features/site/settings'

export async function publicApi<T>(event: H3Event, path: string): Promise<T> {
  const base = String(useRuntimeConfig(event).apiBaseUrl).replace(/\/$/, '')
  if (!/^https?:\/\//.test(base)) throw createError({ statusCode: 503, message: '公开内容服务尚未配置' })
  try {
    const response = await $fetch<{ code: number; data: T }>(`${base}${path}`, { timeout: 10000, retry: 0 })
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

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function publicSiteUrl(event: H3Event): string {
  return String(useRuntimeConfig(event).public.siteUrl).replace(/\/$/, '')
}
