/**
 * @file push-main.mjs
 * @description 推送 main 的本机串行入口：经 `corepack pnpm push:main [check:local 参数] [--in-place] [--keep-worktree]`
 *              在 push 锁内依次 fetch、确认本地包含远端最新提交、列出待推送提交及其归属、运行 check:local、推送。
 *              工作区有未提交改动（多会话共用时常见）时，检查改在临时 worktree 里对待推送提交运行：先安装依赖、复制本机
 *              环境文件，结果只取决于要推送的提交，不受别人改了一半的代码影响；推送的是检查过的提交号而不是 HEAD。
 *              --in-place 强制在当前工作区检查；--keep-worktree 保留临时 worktree 便于排查。
 *              不自动 rebase、stash 或改动工作区；待推送提交是否都属于本会话仍由调用者确认（归属见列表）。
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

function git(args, { quiet = false, cwd } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : ['ignore', 'pipe', 'inherit'],
  })
  return { ok: result.status === 0, out: (result.stdout ?? '').trim() }
}

function stop(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

const OWN_FLAGS = new Set(['--in-place', '--keep-worktree'])
const argv = process.argv.slice(2)
const inPlace = argv.includes('--in-place')
const keepWorktree = argv.includes('--keep-worktree')
const checkArgs = argv.filter((arg) => !OWN_FLAGS.has(arg))
const root = git(['rev-parse', '--show-toplevel']).out

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).out
if (branch !== 'main') stop(`当前分支是 ${branch}，push:main 只在 main 上使用。`)

console.log('▶ 获取远端 main')
if (!git(['fetch', 'origin', 'main']).ok) stop('git fetch 失败，检查网络后重试。')

if (!git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { quiet: true }).ok) {
  stop(
    '远端 main 有本地没有的提交。先确认工作区没有其他会话未提交的改动，再 `git pull --rebase origin main`，然后重新运行 push:main。',
  )
}

const sha = git(['rev-parse', 'HEAD']).out
if (!git(['log', '--oneline', 'origin/main..HEAD']).out) {
  console.log('没有待推送的提交。')
  process.exit(0)
}
console.log('\n待推送提交（方括号内为归属；应全部属于本会话，混有他人提交时先与对方确认）：')
spawnSync('node', [join(root, 'scripts/dev/session.mjs'), 'who', 'origin/main..HEAD'], { stdio: 'inherit' })

const dirty = git(['status', '--porcelain']).out !== ''
let checkRoot = root
if (dirty && !inPlace) {
  checkRoot = join(tmpdir(), `tixxin-push-${sha.slice(0, 8)}`)
  console.log(`\n▶ 工作区有未提交改动，在干净 worktree 中检查 ${sha.slice(0, 8)}：${checkRoot}`)
  git(['worktree', 'remove', '--force', checkRoot], { quiet: true })
  if (!git(['worktree', 'add', '--detach', checkRoot, sha]).ok) stop('创建临时 worktree 失败。')
  // 本机环境文件（.env、.env.local 等）被忽略、不在提交里，测试需要它们读取本机数据库与配置
  const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory']).out.split('\n')
  for (const file of ignored.filter((path) => /(^|\/)\.env(\.[\w-]+)?$/.test(path) && !path.endsWith('.example'))) {
    mkdirSync(dirname(join(checkRoot, file)), { recursive: true })
    copyFileSync(join(root, file), join(checkRoot, file))
  }
  console.log('▶ 安装依赖（离线优先）')
  const install = spawnSync('corepack', ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline'], {
    cwd: checkRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  if (install.status !== 0) cleanupAndStop('临时 worktree 安装依赖失败。')
}

function cleanup() {
  if (checkRoot !== root && !keepWorktree) git(['worktree', 'remove', '--force', checkRoot], { quiet: true })
}
function cleanupAndStop(message) {
  cleanup()
  stop(message)
}

const check = spawnSync('bash', ['scripts/check-local.sh', ...checkArgs], { cwd: checkRoot, stdio: 'inherit' })
cleanup()
if (check.status !== 0) {
  stop(
    checkRoot === root
      ? 'check:local 未通过，修复后重新运行 push:main。'
      : `check:local 在干净 worktree 中未通过，问题在待推送的提交里（与工作区未提交改动无关）。${keepWorktree ? `worktree 保留在 ${checkRoot}` : '加 --keep-worktree 可保留现场排查'}。`,
  )
}

console.log(`\n▶ 推送 ${sha.slice(0, 8)} 到 origin/main`)
if (!git(['push', 'origin', `${sha}:main`]).ok) stop('推送被拒绝；远端可能刚有新提交，重新运行 push:main。')
console.log(`\n✓ 已推送 ${sha.slice(0, 8)}，记得在 CI 结束后确认结果。`)
