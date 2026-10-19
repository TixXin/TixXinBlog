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
    // 全局注入 i18n（zh-CN）；用例需要英文时显式 await useNuxtApp().$i18n.setLocale('en') 并在结束时切回。
    setupFiles: ['./tests/setup/i18n.ts'],
    // Node 25 的原生存储不能覆盖模拟浏览器的 localStorage；对子进程显式关闭。
    execArgv: ['--no-experimental-webstorage'],
    globals: true,
    // 覆盖率只收集与展示，不设阈值门禁，避免首次引入即让 CI 变红。
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // 只统计测试实际加载到的文件：全量 instrument 需要把整个 app 目录
      // 的 .vue 经 Nuxt 环境转换，CI 耗时与不稳定性都会明显上升。
      all: false,
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/.nuxt/**',
        '**/.nuxt-production/**',
        '**/.output/**',
        '**/dist/**',
        '**/coverage/**',
        'tests/**',
        'themes/**',
        'theme-contracts/**',
        'public/**',
        '**/*.d.ts',
        '**/types.ts',
        '**/*.config.{ts,mjs}',
        '**/mocks/**',
        '**/*.mock.ts',
      ],
    },
  },
})
