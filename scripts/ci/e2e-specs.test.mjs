/**
 * @file e2e-specs.test.mjs
 * @description 本地浏览器回归挑选：改动 spec 照跑、全站外壳与构建改动加跑冒烟、普通页面改动不加跑、冒烟清单存在
 * @author TixXin
 * @since 2026-11-05
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { SMOKE_SPECS, selectE2eSpecs } from './e2e-specs.mjs'

const web = 'src/frontend/web-blog/'

test('改动过的 spec 照跑，普通页面与组件改动不加跑冒烟', () => {
  const { specs, notes } = selectE2eSpecs([
    `${web}tests/e2e/link-business.spec.ts`,
    `${web}app/pages/links.vue`,
    `${web}app/components/link/LinkCard.vue`,
  ])
  assert.deepEqual(specs, ['link-business.spec.ts'])
  assert.deepEqual(notes, [])
})

test('构建配置、分块规则、插件、布局、主题、样式、补丁与锁文件改动加跑冒烟', () => {
  for (const file of [
    `${web}nuxt.config.ts`,
    `${web}clientChunking.ts`,
    `${web}package.json`,
    `${web}app/app.vue`,
    `${web}app/layouts/default.vue`,
    `${web}app/plugins/mobile-idle-prefetch.client.ts`,
    `${web}app/assets/styles/main.scss`,
    `${web}themes/nexus/app/components/RootLayout.vue`,
    'patches/nuxt.patch',
    'pnpm-lock.yaml',
  ]) {
    const { specs, notes } = selectE2eSpecs([file])
    assert.deepEqual(specs, SMOKE_SPECS, file)
    assert.equal(notes.length, 1, file)
  }
})

test('改动 spec 与冒烟去重，改动 spec 排在前面', () => {
  const { specs } = selectE2eSpecs([`${web}tests/e2e/blog.spec.ts`, `${web}nuxt.config.ts`])
  assert.equal(specs[0], 'blog.spec.ts')
  assert.equal(specs.filter((spec) => spec === 'blog.spec.ts').length, 1)
  assert.equal(specs.length, SMOKE_SPECS.length)
})

test('冒烟清单中的 spec 都存在', () => {
  for (const spec of SMOKE_SPECS) assert.ok(existsSync(new URL(`../../${web}tests/e2e/${spec}`, import.meta.url)), spec)
})
