/**
 * @file vitest.config.ts
 * @description Vitest 配置，集成 @nuxt/test-utils 提供 Nuxt 运行时环境
 * @author TixXin
 * @since 2026-04-03
 */

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'nuxt',
    // Node 25 的原生存储不能覆盖模拟浏览器的 localStorage；对子进程显式关闭。
    execArgv: ['--no-experimental-webstorage'],
    globals: true,
  },
})
