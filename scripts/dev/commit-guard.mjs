/**
 * @file commit-guard.mjs
 * @description pre-commit 检查，防止多会话共用工作区时把别人的改动带进提交：
 *   1. 本次提交的文件落在其他会话「进行中」的认领里：提示；提交时声明了 TIXXIN_SESSION 且不是认领者时拒绝。
 *   2. 本次提交含共享文件（语言包、package.json、CHANGELOG、AGENTS.md、docs 等）：列出这些文件的改动行，
 *      提交者核对其中没有别人的改动。`git commit -- <路径>` 会提交该文件在工作区的全部内容，同一文件里别人
 *      未提交的改动也会一起进去，路径限定挡不住。
 *   TIXXIN_GUARD=off 跳过本检查（只在核对过、确需提交时使用）。
 * @author TixXin
 * @since 2026-11-06
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BOARD, claimOwners, isSharedFile, parseClaims } from './session-ledger.mjs'

if (process.env.TIXXIN_GUARD === 'off' || process.env.CI === 'true') process.exit(0)

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const root = git('rev-parse', '--show-toplevel').trim()
const mainRoot = resolve(root, git('rev-parse', '--git-common-dir').trim(), '..')
const board = [join(root, BOARD), join(mainRoot, BOARD)].find((path) => existsSync(path))
const claims = board ? parseClaims(readFileSync(board, 'utf8')) : []
const files = git('diff', '--cached', '--name-only', '--diff-filter=ACMRD', 'HEAD').split('\n').filter(Boolean)
const session = process.env.TIXXIN_SESSION?.trim()

const foreign = []
for (const file of files) {
  const owners = claimOwners(file, claims).filter((owner) => owner !== session)
  if (owners.length && !(session && claimOwners(file, claims).includes(session))) foreign.push({ file, owners })
}
if (foreign.length) {
  console.error('\n⚠ 以下文件在其他会话的进行中认领里（corepack pnpm session list 查看）：')
  for (const { file, owners } of foreign) console.error(`  ${file}  ← ${owners.join('、')}`)
  if (session) {
    console.error(
      `\n✗ 当前会话 ${session} 没有认领这些文件，已拒绝提交。先与认领者确认，核对后可用 TIXXIN_GUARD=off 提交。`,
    )
    process.exit(1)
  }
  console.error('  提交前确认改动属于本会话；提交时设 TIXXIN_SESSION=<会话名> 可让此检查直接拒绝越界提交。')
}

const shared = files.filter(isSharedFile)
if (shared.length) {
  console.error('\n⚠ 本次提交含共享文件，确认下列改动行都属于本会话（同一文件里别人的未提交改动也会被一起提交）：')
  for (const file of shared) {
    const lines = git('diff', '--cached', '-U0', '--no-color', 'HEAD', '--', file)
      .split('\n')
      .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    console.error(`  ${file}（${lines.length} 行）`)
    for (const line of lines.slice(0, 12)) console.error(`    ${line.slice(0, 140)}`)
    if (lines.length > 12) console.error(`    … 另有 ${lines.length - 12} 行，用 git diff --cached -- ${file} 查看`)
  }
  console.error('  混进了别人的改动时，按 docs/development.md「只提交自己的改动」处理，不要直接提交。\n')
}
