/** @file state.ts @description 闪念沿用原有实体集合的时效和读取代次，私有草稿不进入公共 LRU。 */
import type { NuxtApp } from '#app'

export const FLASH_PUBLIC_FRESH_MS = 30_000
export const FLASH_PUBLIC_STALE_MS = 5 * 60_000

/** 写后只撤销读取，不清空集合；同页接纳新记录时必须保留其他已保存的私有草稿。 */
export function invalidateFlashNotes(app: NuxtApp, options: { clear?: boolean } = {}) {
  const state = app.payload.state
  state['$sflash-load-version'] = Number(state['$sflash-load-version'] ?? 0) + 1
  state['$sflash-notes-loaded-at'] = 0
  state['$sflash-notes-invalidated'] = true
  state['$sflash-notes-loading'] = false
  state['$sflash-notes-error'] = null
  if (options.clear) {
    state['$sflash-notes'] = []
    state['$sflash-notes-loaded'] = false
    state['$sflash-notes-owner'] = ''
  }
}
