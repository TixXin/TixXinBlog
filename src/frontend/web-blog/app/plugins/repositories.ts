/**
 * @file repositories.ts
 * @description 通过 Nuxt provide/inject 注入闪念与标签页的数据仓库实例
 * @author TixXin
 * @since 2026-04-11
 *
 * 这是 Repository 模式的「单点切换」入口：
 * - useMockRepo === true  → 使用 LocalStorage 实现（mock 阶段，演示用）
 * - useMockRepo === false → 使用 HTTP 实现（后端就绪后启用）
 *
 * 切换只需改 nuxt.config.ts 的 runtimeConfig.public.useMockRepo，组件代码零改动。
 */

import { LocalFlashRepository } from '~/features/flash/repository.local'
import { HttpFlashRepository } from '~/features/flash/repository.http'
import { LocalTabRepository } from '~/features/tab/repository.local'
import { HttpTabRepository } from '~/features/tab/repository.http'
import type { FlashNoteRepository } from '~/features/flash/repository'
import type { TabBookmarkRepository } from '~/features/tab/repository'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const useMock = config.public.useMockRepo !== false

  const flashRepo: FlashNoteRepository = useMock
    ? new LocalFlashRepository()
    : new HttpFlashRepository()

  const tabRepo: TabBookmarkRepository = useMock
    ? new LocalTabRepository()
    : new HttpTabRepository()

  nuxtApp.provide('flashRepo', flashRepo)
  nuxtApp.provide('tabRepo', tabRepo)
})

declare module '#app' {
  interface NuxtApp {
    $flashRepo: FlashNoteRepository
    $tabRepo: TabBookmarkRepository
  }
}
