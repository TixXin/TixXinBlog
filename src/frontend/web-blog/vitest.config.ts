/**
 * @file vitest.config.ts
 * @description Vitest 配置，集成 @nuxt/test-utils 提供 Nuxt 运行时环境
 * @author TixXin
 * @since 2026-04-03
 */

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
  },
})
