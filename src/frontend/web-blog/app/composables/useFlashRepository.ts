/**
 * @file useFlashRepository.ts
 * @description 通过 Nuxt $flashRepo 访问闪念数据仓库的薄封装
 * @author TixXin
 * @since 2026-04-11
 */

import type { FlashNoteRepository } from '~/features/flash/repository'

export function useFlashRepository(): FlashNoteRepository {
  const { $flashRepo } = useNuxtApp()
  if (!$flashRepo) {
    throw new Error('flashRepo 未注入，请检查 plugins/repositories.ts 是否启用')
  }
  return $flashRepo
}
