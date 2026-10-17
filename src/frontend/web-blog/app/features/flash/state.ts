/** @file state.ts @description 闪念沿用原有实体集合的时效和读取代次，私有草稿不进入公共 LRU。 */
import type { NuxtApp } from '#app'

export const FLASH_PUBLIC_FRESH_MS = 30_000
export const FLASH_PUBLIC_STALE_MS = 5 * 60_000
/** 公开列表每页条数：SSR 首屏直出一页，后续按需追加；后端上限为 100。 */
export const FLASH_PUBLIC_PAGE_SIZE = 20

/** 写后只撤销读取，不清空集合；同页接纳新记录时必须保留其他已保存的私有草稿。 */
export function invalidateFlashNotes(app: NuxtApp, options: { clear?: boolean } = {}) {
  const state = app.payload.state
  state['$sflash-load-version'] = Number(state['$sflash-load-version'] ?? 0) + 1
  state['$sflash-overview-version'] = Number(state['$sflash-overview-version'] ?? 0) + 1
  state['$sflash-notes-loaded-at'] = 0
  state['$sflash-notes-invalidated'] = true
  state['$sflash-notes-loading'] = false
  state['$sflash-notes-error'] = null
  // 在途的追加页与侧栏概览随读取代次一起作废，不能停在“加载中”。
  state['$sflash-more-loading'] = false
  state['$sflash-more-error'] = null
  state['$sflash-overview-loaded-at'] = 0
  state['$sflash-overview-loading'] = false
  state['$sflash-overview-error'] = null
  if (options.clear) {
    state['$sflash-notes'] = []
    state['$sflash-notes-loaded'] = false
    state['$sflash-notes-owner'] = ''
    state['$sflash-notes-total'] = 0
    state['$sflash-notes-pages'] = 0
    state['$sflash-notes-query'] = ''
    state['$sflash-public-total'] = null
    state['$sflash-overview'] = []
    state['$sflash-overview-loaded'] = false
  }
}
