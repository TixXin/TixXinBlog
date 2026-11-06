/**
 * @file session.mjs
 * @description 多会话认领与提交归属：corepack pnpm session <子命令>
 *   claim <会话名> <任务> <路径或通配...>   在 .artifacts/COORDINATION.md 认领表追加一行「进行中」
 *   done <会话名> [结果] [--task <关键字>]  把该会话进行中的认领改为「已完成（日期）：结果」
 *   list                                    列出进行中的认领
 *   who [<范围>]                            列出提交及其归属（默认 origin/main..HEAD）
 *   own <会话名> [<提交>]                   手动登记提交归属（默认 HEAD）
 *   record                                  供 post-commit 钩子调用：按 TIXXIN_SESSION 或认领推断登记 HEAD
 * 认领只是登记与提示，不阻止别人编辑；提交前检查（commit-guard）会在改到他人认领的文件时给出警告。
 * @author TixXin
 * @since 2026-11-06
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  BOARD,
  appendClaim,
  commitsFile,
  finishClaims,
  inferOwner,
  parseClaims,
  readCommits,
  recordCommit,
} from './session-ledger.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const root = git('rev-parse', '--show-toplevel')
const commonDir = resolve(root, git('rev-parse', '--git-common-dir'))
// 认领表在主工作区的 .artifacts 下；从 worktree 调用时回到主工作区读取
const mainRoot = resolve(commonDir, '..')
const boardPath = existsSync(join(root, BOARD)) ? join(root, BOARD) : join(mainRoot, BOARD)
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })

function readBoard() {
  return existsSync(boardPath) ? readFileSync(boardPath, 'utf8') : ''
}

/** 某提交的归属：先看台账，再按进行中的认领推断 */
function ownerOf(sha, commits = readCommits(commitsFile(commonDir)), claims = parseClaims(readBoard())) {
  if (commits[sha]) return commits[sha].owner
  const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)
  const inferred = inferOwner(files, claims)
  return inferred ? `${inferred}（按认领推断）` : null
}

function usage() {
  console.log(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(2, 11)
      .join('\n')
      .replace(/^ \*\s?/gm, ''),
  )
}

function main([command, ...args]) {
  switch (command) {
    case 'claim': {
      const [owner, task, ...paths] = args
      if (!owner || !task || !paths.length) throw new Error('用法：session claim <会话名> <任务> <路径或通配...>')
      if (!existsSync(boardPath)) throw new Error(`没有 ${BOARD}，无法登记认领`)
      const board = readBoard()
      const taken = parseClaims(board).filter((claim) => claim.active && claim.owner !== owner)
      writeFileSync(boardPath, appendClaim(board, { task, owner, paths, date: today() }))
      console.log(`✓ 已登记：${owner} 认领「${task}」：${paths.join('、')}`)
      if (taken.length) console.log(`其他进行中的认领：\n${taken.map((c) => `  ${c.owner}：${c.task}`).join('\n')}`)
      return
    }
    case 'done': {
      const taskIndex = args.indexOf('--task')
      const task = taskIndex >= 0 ? args.splice(taskIndex, 2)[1] : undefined
      const [owner, result] = args
      if (!owner) throw new Error('用法：session done <会话名> [结果] [--task <关键字>]')
      const status = `已完成（${today()}）${result ? `：${result}` : ''}`
      const next = finishClaims(readBoard(), { owner, task, result: status })
      if (!next.changed) throw new Error(`${owner} 没有进行中的认领`)
      writeFileSync(boardPath, next.markdown)
      console.log(`✓ 已结束 ${next.changed} 条认领`)
      return
    }
    case 'list': {
      const active = parseClaims(readBoard()).filter((claim) => claim.active)
      if (!active.length) return console.log('没有进行中的认领。')
      for (const claim of active)
        console.log(`${claim.owner}｜${claim.status}｜${claim.task}\n  ${claim.paths.join('、')}`)
      return
    }
    case 'who': {
      const range = args[0] ?? 'origin/main..HEAD'
      const commits = readCommits(commitsFile(commonDir))
      const claims = parseClaims(readBoard())
      const rows = git('log', '--format=%H%x09%h%x09%s', range).split('\n').filter(Boolean)
      if (!rows.length) return console.log(`${range} 没有提交。`)
      for (const row of rows) {
        const [sha, short, subject] = row.split('\t')
        console.log(`${short} [${ownerOf(sha, commits, claims) ?? '未登记'}] ${subject}`)
      }
      return
    }
    case 'own': {
      const [owner, rev = 'HEAD'] = args
      if (!owner) throw new Error('用法：session own <会话名> [<提交>]')
      const sha = git('rev-parse', rev)
      recordCommit(commitsFile(commonDir), sha, { owner, at: new Date().toISOString(), source: 'manual' })
      console.log(`✓ ${sha.slice(0, 8)} 归属 ${owner}`)
      return
    }
    case 'record': {
      // post-commit：不能因记录失败影响提交
      try {
        const sha = git('rev-parse', 'HEAD')
        const owner =
          process.env.TIXXIN_SESSION?.trim() ||
          inferOwner(git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean), parseClaims(readBoard()))
        if (owner) {
          const source = process.env.TIXXIN_SESSION ? 'env' : 'claim'
          recordCommit(commitsFile(commonDir), sha, { owner, at: new Date().toISOString(), source })
        }
      } catch {
        /* 记录是辅助信息，失败时忽略 */
      }
      return
    }
    default:
      usage()
  }
}

try {
  main(process.argv.slice(2))
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
}
