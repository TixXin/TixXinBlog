/**
 * @file playwright.motion.config.ts
 * @description 使用同一隔离环境验证Chromium、Firefox与WebKit，保留默认CI配置
 * @author TixXin
 * @since 2026-09-08
 */
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
