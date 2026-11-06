/**
 * @file session-ledger.mjs
 * @description 多会话台账的纯逻辑：解析与改写 .artifacts/COORDINATION.md 的「认领表」，按认领的路径或通配推断文件归属，
 *              读写本机提交归属记录（Git 公共目录 tixxin-sessions/commits.json，worktree 之间共享、不进版本库）。
 *              认领表仍是任务面板与 agy 任务说明读取的数据源，这里只追加行与改写状态列，不重排已有内容。
 * @author TixXin
 * @since 2026-11-06
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const BOARD = '.artifacts/COORDINATION.md'
const TABLE_TITLE = '## 认领表'
const ACTIVE = /^(进行中|认领|处理中)/

/** 认领表的数据行：{ index, task, owner, status, paths, active } */
export function parseClaims(markdown) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === TABLE_TITLE)
  if (start < 0) return []
  const rows = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^## /.test(line)) break
    if (!line.startsWith('|') || /^\|\s*(任务|-)/.test(line)) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.length < 4) continue
    const [task, owner, status, files] = cells
    const paths = [...files.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean)
    rows.push({ index: i, task, owner, status, paths, active: ACTIVE.test(status) })
  }
  return rows
}

/** 展开 {a,b} 与 a/{b,c}/d 形式的通配 */
export function expandBraces(pattern) {
  const match = /\{([^{}]*)\}/.exec(pattern)
  if (!match) return [pattern]
  const head = pattern.slice(0, match.index)
  const tail = pattern.slice(match.index + match[0].length)
  return match[1].split(',').flatMap((part) => expandBraces(head + part + tail))
}

/** 通配转正则：** 跨目录，* 不跨目录；目录（以 / 结尾或无通配无扩展名）匹配其下所有文件 */
export function globToRegExp(pattern) {
  let glob = pattern.replace(/^\.\//, '').replace(/（.*$/, '').trim()
  if (glob.endsWith('/')) glob += '**'
  else if (!/[*?]/.test(glob) && !/\.[A-Za-z0-9]+$/.test(glob)) glob += '/**'
  const body = glob
    .split(/(\*\*\/?|\*|\?)/)
    .map((part) => {
      if (part === '**/' || part === '**') return '(?:.*/)?' + (part === '**' ? '.*' : '')
      if (part === '*') return '[^/]*'
      if (part === '?') return '[^/]'
      return part.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  // 认领表里常写相对子项目的路径（如 app/pages/**），允许匹配任意前缀目录
  return new RegExp(`(?:^|/)${body}$`)
}

/** 文件命中的进行中认领的负责人（去重） */
export function claimOwners(file, claims) {
  const owners = new Set()
  for (const claim of claims) {
    if (!claim.active) continue
    const hit = claim.paths.some((path) => expandBraces(path).some((glob) => globToRegExp(glob).test(file)))
    if (hit) owners.add(claim.owner)
  }
  return [...owners]
}

/** 一组文件的归属：全部命中同一负责人时返回该负责人，否则返回 null */
export function inferOwner(files, claims) {
  const owners = new Set(files.flatMap((file) => claimOwners(file, claims)))
  return owners.size === 1 ? [...owners][0] : null
}

const cell = (value) => String(value).replace(/\|/g, '／').replace(/\n/g, ' ').trim()

/** 在认领表末尾追加一行进行中的认领 */
export function appendClaim(markdown, { task, owner, paths, date }) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === TABLE_TITLE)
  if (start < 0) throw new Error(`${BOARD} 缺少「${TABLE_TITLE}」`)
  let last = start
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) if (lines[i].startsWith('|')) last = i
  if (last === start) throw new Error('认领表缺少表头')
  const files = paths.map((path) => `\`${path}\``).join('、')
  lines.splice(last + 1, 0, `| ${cell(task)} | ${cell(owner)} | 进行中（${date}） | ${files} |`)
  return lines.join('\n')
}

/** 把某负责人的进行中认领改为已完成或放弃；task 给出时只改任务名包含它的行 */
export function finishClaims(markdown, { owner, task, result }) {
  const lines = markdown.split('\n')
  let changed = 0
  for (const claim of parseClaims(markdown)) {
    if (!claim.active || claim.owner !== owner || (task && !claim.task.includes(task))) continue
    const cells = lines[claim.index].split('|')
    cells[3] = ` ${cell(result)} `
    lines[claim.index] = cells.join('|')
    changed++
  }
  return { markdown: lines.join('\n'), changed }
}

/** 本机提交归属记录：{ "<完整提交号>": { owner, at, source } } */
export function commitsFile(commonDir) {
  return join(commonDir, 'tixxin-sessions', 'commits.json')
}

export function readCommits(file) {
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export function recordCommit(file, sha, entry) {
  const commits = readCommits(file)
  commits[sha] = entry
  // 只保留最近 500 条，台账不无限增长
  const kept = Object.entries(commits)
    .sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)))
    .slice(0, 500)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(Object.fromEntries(kept), null, 2) + '\n')
}

/** 需要格外核对的共享文件：多会话最常在同一文件里各改一处 */
export const SHARED_FILES = [
  /(^|\/)i18n\/locales\/[^/]+\/[^/]+\.json$/,
  /(^|\/)package\.json$/,
  /^pnpm-lock\.yaml$/,
  /(^|\/)nuxt\.config\.ts$/,
  /^CHANGELOG\.md$/,
  /^AGENTS\.md$/,
  /^docs\//,
  /(^|\/)migrations\/\.snapshot-[^/]+\.json$/,
]
export const isSharedFile = (file) => SHARED_FILES.some((pattern) => pattern.test(file))
