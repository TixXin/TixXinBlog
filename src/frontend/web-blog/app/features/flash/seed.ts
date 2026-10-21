/**
 * @file seed.ts
 * @description 本地演示闪念版本检测与增量补种：保留用户修改与删除，仅补入新版本默认种子
 * @author TixXin
 * @since 2026-10-21
 */

import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from '~/features/flash/mock'

/**
 * 增量补种：seed 版本升级时，把当前 list 里没有的 seed id 补进 storage。
 * 已存在的 id 跳过（保留用户对该条目的修改/删除/归档），归档项也算"已存在"。
 * 一次性，写入版本号后下次 load 直接跳过。
 */
export async function ensureSeedsUpToDate(repo: ReturnType<typeof useFlashRepository>, userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const versionKey = `flash:seeds:version:${userId}`
  const localVersion = Number(window.localStorage.getItem(versionKey) ?? '0')
  if (localVersion >= FLASH_SEEDS_VERSION) return

  const [active, archived] = await Promise.all([repo.list(userId), repo.listArchived(userId)])
  const existingIds = new Set([...active, ...archived].map((n) => n.id))
  for (const draft of defaultFlashNoteSeeds) {
    if (draft.id && !existingIds.has(draft.id)) {
      await repo.create(userId, draft)
    }
  }
  window.localStorage.setItem(versionKey, String(FLASH_SEEDS_VERSION))
}
