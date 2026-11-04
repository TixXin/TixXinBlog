#!/usr/bin/env node
/**
 * @file check-client-chunks.mjs
 * @description 生产客户端分块预算检查：读取构建时 CHUNK_REPORT 输出的块报告（见 src/frontend/web-blog/clientChunking.ts），
 *   检查单块体积上限，并按“主入口 + 默认布局 + 页面”的静态导入闭包推算公开页面首屏必载的块，
 *   要求块数不超过预算、不含后台或主题源码。防止新增组件或升级 Vite/rolldown 后分块悄悄退化。
 *   用法：CHUNK_REPORT=<路径> corepack pnpm build && node scripts/ci/check-client-chunks.mjs <路径>
 * @author TixXin
 * @since 2026-11-05
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 单个 JS 块的体积上限（字节，未压缩） */
export const MAX_CHUNK_BYTES = 250 * 1024
/** 公开页面首屏静态闭包的块数上限；2026-11-05 实测 15–24 个，留出余量 */
export const MAX_FIRST_SCREEN_CHUNKS = 30
/** 检查的公开页面与首屏共有的默认布局（模块路径相对 web-blog） */
export const PUBLIC_PAGES = [
  'app/pages/index.vue',
  'app/pages/moments/index.vue',
  'app/pages/gallery.vue',
  'app/pages/about.vue',
]
const DEFAULT_LAYOUT = 'app/layouts/default.vue'
/** 首屏不得出现的源码：后台页面、布局与组件，以及主题目录（主题按需加载，不应进入静态闭包） */
const FORBIDDEN_MODULE = /^(?:app\/pages\/admin\/|app\/components\/admin\/|app\/layouts\/admin\.vue|themes\/)/

/** 找出承载某模块的块：优先以它为入口的块；模块被合并组捕获（如默认布局进入外壳块）时取所在块 */
function chunkOf(report, modulePath) {
  const holders = report.filter((chunk) => chunk.modules.includes(modulePath))
  return holders.find((chunk) => chunk.entry) ?? holders[0]
}

/** 从若干起点块出发，沿静态 imports 求闭包 */
export function staticClosure(report, starts) {
  const byFile = new Map(report.map((chunk) => [chunk.file, chunk]))
  const seen = new Set()
  const queue = starts.map((chunk) => chunk.file)
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file) || !byFile.has(file)) continue
    seen.add(file)
    queue.push(...(byFile.get(file).imports ?? []))
  }
  return [...seen].map((file) => byFile.get(file))
}

/** 执行全部检查，返回问题列表与各页面的首屏统计 */
export function checkChunks(report, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_CHUNK_BYTES
  const maxChunks = options.maxChunks ?? MAX_FIRST_SCREEN_CHUNKS
  const pages = options.pages ?? PUBLIC_PAGES
  const problems = []
  for (const chunk of report) {
    if (chunk.bytes > maxBytes)
      problems.push(`${chunk.file} 体积 ${Math.round(chunk.bytes / 1024)}KB，超过上限 ${Math.round(maxBytes / 1024)}KB`)
  }
  const main = report.filter((chunk) => chunk.main)
  const layout = chunkOf(report, DEFAULT_LAYOUT)
  if (!main.length) problems.push('块报告中没有主入口（main），请确认报告来自客户端生产构建')
  if (!layout) problems.push(`块报告中找不到默认布局 ${DEFAULT_LAYOUT} 所在的块`)
  const pageStats = []
  for (const page of pages) {
    const pageChunk = chunkOf(report, page)
    if (!pageChunk) {
      problems.push(`块报告中找不到页面 ${page} 所在的块`)
      continue
    }
    const closure = staticClosure(report, [...main, ...(layout ? [layout] : []), pageChunk])
    const bytes = closure.reduce((sum, chunk) => sum + chunk.bytes, 0)
    pageStats.push({ page, chunks: closure.length, bytes })
    if (closure.length > maxChunks) problems.push(`${page} 首屏静态闭包 ${closure.length} 个块，超过预算 ${maxChunks}`)
    // 路由表为读取页面元数据静态导入各页面的 ?macro=true 模块，属正常情况，不计为后台代码
    const leaked = closure.flatMap((chunk) =>
      chunk.modules.filter((module) => !module.includes('macro=true') && FORBIDDEN_MODULE.test(module)),
    )
    if (leaked.length) problems.push(`${page} 首屏含后台或主题源码：${[...new Set(leaked)].slice(0, 5).join('、')}`)
  }
  return { problems, pageStats }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? process.env.CHUNK_REPORT
  if (!path) {
    console.error('用法：node scripts/ci/check-client-chunks.mjs <块报告路径>')
    process.exit(2)
  }
  const { problems, pageStats } = checkChunks(JSON.parse(readFileSync(path, 'utf8')))
  for (const stat of pageStats)
    console.log(`${stat.page}：首屏静态闭包 ${stat.chunks} 个块，${Math.round(stat.bytes / 1024)}KB`)
  if (problems.length) {
    console.error(`\n客户端分块检查未通过：\n- ${problems.join('\n- ')}`)
    console.error('\n规则与调整方法见 docs/architecture.md 的分块说明（src/frontend/web-blog/clientChunking.ts）。')
    process.exit(1)
  }
  console.log('客户端分块检查通过。')
}
