/**
 * @file repositories.ts
 * @description 通过 Nuxt provide/inject 注入闪念与标签页的数据仓库实例
 * @author TixXin
 * @since 2026-04-11
 *
 * 闪念域按配置切换，标签页域明确保留本地仓库：
 * - useMockRepo === true  → 使用 LocalStorage 实现（mock 阶段，演示用）
 * - useMockRepo === false → 使用 HTTP 实现（后端就绪后启用）
 *
 * 切换只需改 nuxt.config.ts 的 runtimeConfig.public.useMockRepo，组件代码零改动。
 */

import { LocalFlashRepository } from '~/features/flash/repository.local'
import { HttpFlashRepository } from '~/features/flash/repository.http'
import { LocalTabRepository } from '~/features/tab/repository.local'
import type { FlashNoteRepository } from '~/features/flash/repository'
import type { TabBookmarkRepository } from '~/features/tab/repository'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const useMock = config.public.useMockRepo !== false
  const apiBaseUrl = config.public.apiBaseUrl as string
  const admin = useAdminApi()
  const { isLoggedIn } = useCurrentUser()

  const flashRepo: FlashNoteRepository = useMock
    ? new LocalFlashRepository()
    : new HttpFlashRepository(apiBaseUrl, admin, () => isLoggedIn.value)

  // 标签页后端尚未实现，明确保持本地仓库，不随已接通的文章/闪念域切换。
  const tabRepo: TabBookmarkRepository = new LocalTabRepository()

  nuxtApp.provide('flashRepo', flashRepo)
  nuxtApp.provide('tabRepo', tabRepo)
})

declare module '#app' {
  interface NuxtApp {
    $flashRepo: FlashNoteRepository
    $tabRepo: TabBookmarkRepository
  }
}
