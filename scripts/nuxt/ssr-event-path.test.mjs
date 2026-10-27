/** @file ssr-event-path.test.mjs @description 执行固定 @nuxt/nitro-server 补丁的真实 encodeEventPath，验证 SSR 地址只编码一次 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test from 'node:test'

const require = createRequire(new URL('../../src/frontend/web-blog/package.json', import.meta.url))
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const serverPackage = nuxtRequire.resolve('@nuxt/nitro-server/package.json')
const serverRequire = createRequire(serverPackage)
const { decodePath, encodePath } = serverRequire('ufo')
// 只截取函数本体执行；函数来自实际安装的补丁产物，不另写一份实现。
const source = readFileSync(join(dirname(serverPackage), 'dist/runtime/utils/renderer/app.mjs'), 'utf8')
const body = source.match(/function encodeEventPath\(path\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(body, '未找到 encodeEventPath，升级 Nuxt 后需重新核对补丁')
const encodeEventPath = new Function('decodePath', 'encodePath', `${body}\nreturn encodeEventPath`)(
  decodePath,
  encodePath,
)

test('已编码的中文路径不再二次编码，查询串原样保留', () => {
  assert.equal(encodeEventPath('/tags/%E7%94%9F%E6%B4%BB'), '/tags/%E7%94%9F%E6%B4%BB')
  assert.equal(encodeEventPath('/tags/%E7%94%9F%E6%B4%BB?page=2&q=%25'), '/tags/%E7%94%9F%E6%B4%BB?page=2&q=%25')
})

test('未编码的字符照常编码，编码斜杠与字面量百分号不被还原', () => {
  assert.equal(encodeEventPath('/tags/生活'), '/tags/%E7%94%9F%E6%B4%BB')
  assert.equal(encodeEventPath('/a b'), '/a%20b')
  assert.equal(encodeEventPath('/a%2Fb'), '/a%2Fb')
  assert.equal(encodeEventPath('/a%25b'), '/a%25b')
  assert.equal(encodeEventPath('/articles/4408'), '/articles/4408')
})
