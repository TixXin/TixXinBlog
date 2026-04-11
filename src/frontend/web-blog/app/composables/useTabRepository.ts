/**
 * @file useTabRepository.ts
 * @description 通过 Nuxt $tabRepo 访问标签页数据仓库的薄封装
 * @author TixXin
 * @since 2026-04-11
 */

import type { TabBookmarkRepository } from '~/features/tab/repository'

export function useTabRepository(): TabBookmarkRepository {
  const { $tabRepo } = useNuxtApp()
  if (!$tabRepo) {
    throw new Error('tabRepo 未注入，请检查 plugins/repositories.ts 是否启用')
  }
  return $tabRepo
}
