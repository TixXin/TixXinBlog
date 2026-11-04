/**
 * @file check-client-chunks.test.mjs
 * @description 客户端分块预算检查：单块上限、首屏静态闭包块数、后台与主题源码泄漏、报告缺项
 * @author TixXin
 * @since 2026-11-05
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkChunks, staticClosure } from './check-client-chunks.mjs'

const PAGE = 'app/pages/index.vue'
const options = { pages: [PAGE], maxChunks: 4, maxBytes: 1000 }

/** 主入口 → 外壳（含默认布局）；页面 → 公共块 */
function report(extra = {}) {
  return [
    { file: 'main.js', bytes: 100, entry: true, main: true, imports: ['shell.js'], modules: ['entry.js'] },
    {
      file: 'shell.js',
      bytes: 100,
      entry: false,
      main: false,
      imports: [],
      modules: ['app/layouts/default.vue', 'app/pages/admin/site.vue?macro=true'],
    },
    {
      file: 'page.js',
      bytes: 100,
      entry: true,
      main: false,
      imports: ['common.js', ...(extra.pageImports ?? [])],
      modules: [PAGE],
    },
    { file: 'common.js', bytes: 100, entry: false, main: false, imports: [], modules: ['app/utils/format.ts'] },
    {
      file: 'admin.js',
      bytes: 100,
      entry: true,
      main: false,
      imports: [],
      modules: ['app/components/admin/MediaPicker.vue'],
    },
    {
      file: 'theme.js',
      bytes: 100,
      entry: true,
      main: false,
      imports: [],
      modules: ['themes/aurora/app/components/RootLayout.vue'],
    },
    ...(extra.chunks ?? []),
  ]
}

test('首屏闭包沿静态导入展开，不含未被引用的后台与主题块', () => {
  const files = staticClosure(report(), [report()[0], report()[2]]).map((chunk) => chunk.file)
  assert.deepEqual(files.sort(), ['common.js', 'main.js', 'page.js', 'shell.js'])
  const { problems, pageStats } = checkChunks(report(), options)
  assert.deepEqual(problems, [])
  assert.deepEqual(pageStats, [{ page: PAGE, chunks: 4, bytes: 400 }])
})

test('路由元数据 ?macro=true 模块不计为后台代码', () => {
  assert.deepEqual(checkChunks(report(), options).problems, [])
})

test('首屏静态引入后台组件或主题源码时报错', () => {
  const admin = checkChunks(report({ pageImports: ['admin.js'] }), { ...options, maxChunks: 10 }).problems
  assert.match(admin.join('\n'), /首屏含后台或主题源码：app\/components\/admin\/MediaPicker\.vue/)
  const theme = checkChunks(report({ pageImports: ['theme.js'] }), { ...options, maxChunks: 10 }).problems
  assert.match(theme.join('\n'), /themes\/aurora/)
})

test('首屏块数超过预算时报错', () => {
  const extra = { file: 'extra.js', bytes: 10, entry: false, main: false, imports: [], modules: ['app/utils/x.ts'] }
  const { problems } = checkChunks(report({ pageImports: ['extra.js'], chunks: [extra] }), options)
  assert.match(problems.join('\n'), /首屏静态闭包 5 个块，超过预算 4/)
})

test('任一块超过体积上限时报错，即使不在首屏', () => {
  const big = { file: 'charts.js', bytes: 2048, entry: true, main: false, imports: [], modules: ['echarts.js'] }
  assert.match(checkChunks(report({ chunks: [big] }), options).problems.join('\n'), /charts\.js 体积 2KB，超过上限 1KB/)
})

test('报告缺少主入口、默认布局或页面时报错，避免空报告误判通过', () => {
  const problems = checkChunks([], options).problems.join('\n')
  assert.match(problems, /没有主入口/)
  assert.match(problems, /默认布局/)
  assert.match(problems, /页面 app\/pages\/index\.vue/)
})
