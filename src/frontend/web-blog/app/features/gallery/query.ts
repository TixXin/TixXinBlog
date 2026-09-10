/** @file query.ts @description 图库 URL 状态规范化，空分类与全部分类保持不同含义 */
import type { GalleryQuery } from './types'
export function galleryQuery(query: Record<string, unknown>): GalleryQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.slice(0, 200).trim() || undefined : undefined,
    category: typeof query.category === 'string' ? query.category.slice(0, 40) : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
}
export function galleryPhotoId(value: unknown): number | null {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null
}
