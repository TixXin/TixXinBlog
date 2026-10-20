#!/usr/bin/env node
/**
 * @file check-file-size.mjs
 * @description 源码文件体量检查（棘轮）：新文件不得超过上限；存量超限文件登记在基线中，只许变短不许变长。
 *              规则与例外见 docs/code-organization.md。
 *              用法：node scripts/check-file-size.mjs [--update]
 *              --update 只收紧基线（删除已达标文件、调低行数），不会放宽
 * @author TixXin
 * @since 2026-10-20
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = join(ROOT, 'scripts/file-size-baseline.json')

/** 扫描范围与上限（行，含空行与注释） */
const SCOPES = [
  { dir: 'src/frontend/web-blog/app/pages', ext: ['.vue'], max: 300 },
  { dir: 'src/frontend/web-blog/app', ext: ['.vue'], max: 400 },
  { dir: 'src/frontend/web-blog/app', ext: ['.ts'], max: 300 },
  { dir: 'src/frontend/web-blog/server', ext: ['.ts'], max: 300 },
  { dir: 'src/frontend/web-blog/themes', ext: ['.vue'], max: 400 },
  { dir: 'src/frontend/web-blog/themes', ext: ['.ts'], max: 300 },
  { dir: 'src/backend/server-main/src', ext: ['.ts'], max: 300 },
]

/** 不受体量约束：测试、迁移、样本与 Mock 数据、生成物 */
const EXEMPT = [
  /\.spec\.ts$/,
  /\.test\.ts$/,
  /\/__tests__\//,
  /\/migrations\//,
  /\/seeders\//,
  /\/mock\.ts$/,
  /\.d\.ts$/,
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, files)
    else files.push(path)
  }
  return files
}

function lines(path) {
  const text = readFileSync(path, 'utf8')
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
}

/** 每个文件取第一个匹配的范围（pages 先于 app），返回 { 路径: { lines, max } } */
function measure() {
  const result = {}
  for (const scope of SCOPES) {
    for (const file of walk(join(ROOT, scope.dir))) {
      const path = relative(ROOT, file).split(sep).join('/')
      if (result[path] || !scope.ext.some((ext) => path.endsWith(ext))) continue
      if (EXEMPT.some((pattern) => pattern.test(path))) continue
      result[path] = { lines: lines(file), max: scope.max }
    }
  }
  return result
}

const files = measure()
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const recorded = baseline.files

if (process.argv.includes('--update')) {
  const next = {}
  for (const [path, limit] of Object.entries(recorded)) {
    const current = files[path]
    if (current && current.lines > current.max) next[path] = Math.min(limit, current.lines)
  }
  writeFileSync(BASELINE, `${JSON.stringify({ ...baseline, files: next }, null, 2)}\n`)
  const removed = Object.keys(recorded).length - Object.keys(next).length
  console.log(`基线已收紧：${Object.keys(next).length} 个存量超限文件，移除 ${removed} 个已达标文件。`)
  process.exit(0)
}

const problems = []
let improvable = 0
for (const [path, { lines: count, max }] of Object.entries(files)) {
  if (count <= max) continue
  const limit = recorded[path]
  if (limit === undefined) problems.push(`${path}：${count} 行，超过 ${max} 行上限（新文件或曾达标的文件不得超限）`)
  else if (count > limit) problems.push(`${path}：${count} 行，超过基线 ${limit} 行（存量超限文件只许变短）`)
  else if (count < limit) improvable += 1
}
const stale = Object.keys(recorded).filter((path) => !files[path] || files[path].lines <= files[path].max).length

if (problems.length) {
  console.error('源码文件体量检查未通过：')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('请按 docs/code-organization.md 拆分：页面只做组装，流程放组合函数，区块拆成子组件，纯逻辑放领域模块。')
  process.exit(1)
}
const tighten = improvable + stale
console.log(
  `源码文件体量检查通过（${Object.keys(files).length} 个文件，存量超限 ${Object.keys(recorded).length - stale} 个）` +
    (tighten
      ? `；有 ${tighten} 个文件已变短或达标，可运行 node scripts/check-file-size.mjs --update 收紧基线。`
      : '。'),
)
