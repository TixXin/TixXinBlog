#!/usr/bin/env node
/**
 * @file check-utc-day.mjs
 * @description UTC 截日检查（棘轮）：`.slice(0, 10)` 截取 ISO 时间得到的是 UTC 日期，全站已按站点时区（默认 Asia/Shanghai）分日，
 *              在北京时间 0–8 点两者相差一天；这类写法曾让集成测试只在凌晨失败。新出现的截取必须改用站点时区工具
 *              （前端 app/features/site/timeZone.ts 的 siteDayKey 等，后端 presence-time 等），确为 UTC 日期或本就是纯日期字符串时
 *              在同一行或上一行注释 `utc-day-ok：原因`。存量登记在基线中，只许减少不许增加。
 *              用法：node scripts/check-utc-day.mjs [--update]（--update 只收紧基线）
 * @author TixXin
 * @since 2026-11-06
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = join(ROOT, 'scripts/utc-day-baseline.json')
const DIRS = [
  'src/frontend/web-blog/app',
  'src/frontend/web-blog/server',
  'src/frontend/web-blog/themes',
  'src/backend/server-main/src',
  'src/backend/server-main/tests',
  'src/shared',
]
const EXTENSIONS = ['.ts', '.vue', '.mjs', '.cjs', '.js']
const SKIP = /(^|\/)(node_modules|dist|\.nuxt|\.output)(\/|$)/
const PATTERN = /\.slice\(\s*0\s*,\s*10\s*\)/g

function walk(dir, files = []) {
  if (!existsSync(dir)) return files
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP.test(relative(ROOT, path).split(sep).join('/'))) continue
    if (statSync(path).isDirectory()) walk(path, files)
    else if (EXTENSIONS.some((ext) => name.endsWith(ext))) files.push(path)
  }
  return files
}

/** 每个文件中未注释豁免的截取次数 */
export function countUtcDays(text) {
  const lines = text.split('\n')
  let count = 0
  lines.forEach((line, index) => {
    const hits = line.match(PATTERN)?.length ?? 0
    if (hits && !/utc-day-ok/.test(line) && !/utc-day-ok/.test(lines[index - 1] ?? '')) count += hits
  })
  return count
}

export function measure() {
  const result = {}
  for (const dir of DIRS)
    for (const file of walk(join(ROOT, dir))) {
      const count = countUtcDays(readFileSync(file, 'utf8'))
      if (count) result[relative(ROOT, file).split(sep).join('/')] = count
    }
  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const current = measure()
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
  if (process.argv.includes('--update')) {
    const next = Object.fromEntries(
      Object.entries(baseline)
        .filter(([file]) => current[file])
        .map(([file, count]) => [file, Math.min(count, current[file])]),
    )
    writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n')
    console.log(`UTC 截日基线已收紧：${Object.keys(next).length} 个文件。`)
    process.exit(0)
  }
  const failures = Object.entries(current).filter(([file, count]) => count > (baseline[file] ?? 0))
  if (failures.length) {
    console.error('UTC 截日检查未通过：以下文件新增了 .slice(0, 10) 截日（得到的是 UTC 日期，与站点时区分日不一致）：')
    for (const [file, count] of failures) console.error(`  ${file}：${count}（基线 ${baseline[file] ?? 0}）`)
    console.error('改用站点时区工具（如 siteDayKey），确为 UTC 或纯日期字符串时在该行或上一行注释 utc-day-ok：原因。')
    process.exit(1)
  }
  const shrunk = Object.entries(baseline).filter(([file, count]) => (current[file] ?? 0) < count)
  console.log(
    `UTC 截日检查通过（存量 ${Object.values(current).reduce((sum, n) => sum + n, 0)} 处）。${shrunk.length ? '有文件已减少，可运行 --update 收紧基线。' : ''}`,
  )
}
