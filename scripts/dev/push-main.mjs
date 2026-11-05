/**
 * @file push-main.mjs
 * @description 推送 main 的本机串行入口：经 `corepack pnpm push:main [check:local 参数]` 在 push 锁内依次
 *              fetch、确认本地包含远端最新提交、列出待推送提交、运行 check:local、推送，避免多个会话同时检查与推送。
 *              不自动 rebase、stash 或改动工作区；待推送提交是否都属于本会话仍由调用者在运行前确认。
 */
import { spawnSync } from 'node:child_process'

function git(args, { quiet = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: quiet ? 'pipe' : ['ignore', 'pipe', 'inherit'] })
  return { ok: result.status === 0, out: (result.stdout ?? '').trim() }
}

function stop(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).out
if (branch !== 'main') stop(`当前分支是 ${branch}，push:main 只在 main 上使用。`)

console.log('▶ 获取远端 main')
if (!git(['fetch', 'origin', 'main']).ok) stop('git fetch 失败，检查网络后重试。')

if (!git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { quiet: true }).ok) {
  stop(
    '远端 main 有本地没有的提交。先确认工作区没有其他会话未提交的改动，再 `git pull --rebase origin main`，然后重新运行 push:main。',
  )
}

const pending = git(['log', '--oneline', 'origin/main..HEAD']).out
if (!pending) {
  console.log('没有待推送的提交。')
  process.exit(0)
}
console.log(`\n待推送提交（应全部属于本会话）：\n${pending}\n`)

const check = spawnSync('bash', ['scripts/check-local.sh', ...process.argv.slice(2)], { stdio: 'inherit' })
if (check.status !== 0) stop('check:local 未通过，修复后重新运行 push:main。')

console.log('\n▶ 推送到 origin/main')
if (!git(['push', 'origin', 'HEAD:main']).ok) stop('推送被拒绝；远端可能刚有新提交，重新运行 push:main。')
console.log(`\n✓ 已推送 ${git(['rev-parse', '--short', 'HEAD']).out}，记得在 CI 结束后确认结果。`)
