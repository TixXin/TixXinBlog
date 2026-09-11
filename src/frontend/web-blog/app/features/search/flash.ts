/** @file flash.ts @description 全站搜索使用公开分页接口；显式闪念演示模式只读取已公开本地样本。 */
import type { FlashNote } from '~/features/flash/types'
export async function fetchFlashSearchPage(
  base: string,
  q: string,
  page: number,
  pageSize: number,
  signal: AbortSignal,
) {
  const result = await $fetch<{ code: number; data: { items: FlashNote[]; total: number } }>(
    base.replace(/\/$/, '') + '/flashes/search',
    {
      query: { q, page, pageSize },
      signal,
      timeout: 10000,
      retry: 0,
    },
  )
  if (result.code !== 0) throw new Error('闪念检索失败')
  return result.data
}
