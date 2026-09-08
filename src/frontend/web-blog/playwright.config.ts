/**
 * @file playwright.config.ts
 * @description 仅在隔离测试后端上运行；禁止意外将写入测试指向日常开发数据
 */
import { defineConfig } from '@playwright/test'

if (process.env.E2E_ISOLATED !== 'true') throw new Error('请使用仓库根目录 test:e2e 命令创建隔离环境')

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  outputDir: '../../../.playwright-mcp/e2e-results',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
