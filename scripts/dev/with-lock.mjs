/**
 * @file with-lock.mjs
 * @description 本机互斥锁：多个会话共用一个工作区时，让构建、浏览器回归和推送排队执行，不互相覆盖产物或抢端口。
 *              用法：node scripts/dev/with-lock.mjs <锁名> -- <命令> [参数...]
 *              只给一个参数时按 shell 命令行执行（便于在 package.json 里串联 &&）。
 *              锁文件放在 Git 公共目录的 tixxin-locks/ 下，记录持有进程；持有进程已退出即视为过期并接管，不设超时。
 *              同名锁可重入：子命令再次申请已持有的锁时直接执行（经环境变量 TIXXIN_LOCKS_HELD 传递）。
 *              CI 环境（CI=true）每个任务独占机器，直接执行不加锁。
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, openSync, writeSync, closeSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { constants } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const HELD_ENV = 'TIXXIN_LOCKS_HELD'

/** 锁目录：TIXXIN_LOCK_DIR 优先（测试用），否则取 Git 公共目录，worktree 之间也共享。 */
export function lockDir(env = process.env) {
  if (env.TIXXIN_LOCK_DIR) return env.TIXXIN_LOCK_DIR
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()
  return join(resolve(common), 'tixxin-locks')
}

/** 进程是否存活；EPERM 表示进程存在但属于其他用户。 */
export function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function readOwner(file) {
  try {
    const raw = readFileSync(file, 'utf8')
    return { raw, ...JSON.parse(raw) }
  } catch (error) {
    if (error.code === 'ENOENT') return null
    // 内容不完整：写入方可能刚创建尚未写完，10 秒内当作被占用，超过则视为写入中途崩溃留下的坏锁
    let age = 0
    try {
      age = Date.now() - statSync(file).mtimeMs
    } catch {
      return null
    }
    return { raw: '', pid: 0, corrupt: true, pending: age < 10_000 }
  }
}

/** 尝试一次加锁；成功返回 true，被占用返回当前持有者。 */
export function tryAcquire(file, owner) {
  try {
    const fd = openSync(file, 'wx')
    writeSync(fd, JSON.stringify(owner))
    closeSync(fd)
    return true
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  const current = readOwner(file)
  if (current && !current.pending && (current.corrupt || !alive(current.pid))) {
    // 持有进程已退出：确认内容未被他人改写后删除过期锁，下一轮重新竞争
    const again = readOwner(file)
    if (again && again.raw === current.raw) {
      try {
        unlinkSync(file)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    return { stale: current }
  }
  return current ?? {}
}

export function release(file, pid = process.pid) {
  const current = readOwner(file)
  if (current?.pid === pid) unlinkSync(file)
}

function describe(owner) {
  const since = owner.startedAt ? Math.round((Date.now() - Date.parse(owner.startedAt)) / 1000) : '?'
  return `进程 ${owner.pid ?? '?'}（${owner.command ?? '未知命令'}，已运行 ${since} 秒）`
}

/** 等到拿到锁为止；每 30 秒提示一次仍在排队。 */
export async function acquire(file, owner, { interval = 500, log = console.error } = {}) {
  const startedWaiting = Date.now()
  let lastNotice = 0
  for (;;) {
    const result = tryAcquire(file, owner)
    if (result === true) {
      if (lastNotice) log(`[lock] 已拿到锁，等待 ${Math.round((Date.now() - startedWaiting) / 1000)} 秒`)
      return
    }
    if (result.stale) {
      log(`[lock] 接管过期锁：进程 ${result.stale.pid} 已退出`)
      continue
    }
    if (!lastNotice || Date.now() - lastNotice >= 30_000) {
      log(`[lock] ${owner.name} 锁被占用：${describe(result)}，排队等待…`)
      lastNotice = Date.now()
    }
    await delay(interval)
  }
}

function runChild(command, env) {
  const child =
    command.length === 1
      ? spawn(command[0], { stdio: 'inherit', env, shell: true })
      : spawn(command[0], command.slice(1), { stdio: 'inherit', env })
  // 终端 Ctrl+C 会同时发给子进程；这里只需不让本进程先退出，等子进程结束后释放锁
  const ignore = () => {}
  process.on('SIGINT', ignore)
  process.on('SIGTERM', () => child.kill('SIGTERM'))
  return new Promise((done) => {
    child.on('error', (error) => {
      console.error(`[lock] 无法启动命令：${error.message}`)
      done(127)
    })
    child.on('exit', (code, signal) => done(code ?? 128 + (constants.signals[signal] ?? 0)))
  })
}

async function main(argv) {
  const separator = argv.indexOf('--')
  const name = argv[0]
  const command = separator === -1 ? [] : argv.slice(separator + 1)
  if (!name || separator !== 1 || !/^[\w-]+$/.test(name) || command.length === 0) {
    console.error('用法：node scripts/dev/with-lock.mjs <锁名> -- <命令> [参数...]')
    return 2
  }
  const held = (process.env[HELD_ENV] ?? '').split(',').filter(Boolean)
  if (process.env.CI === 'true' || held.includes(name)) return runChild(command, process.env)

  const dir = lockDir()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${name}.lock`)
  const owner = {
    name,
    pid: process.pid,
    command: command.join(' '),
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
  }
  await acquire(file, owner)
  const releaseOnExit = () => release(file)
  process.on('exit', releaseOnExit)
  const code = await runChild(command, { ...process.env, [HELD_ENV]: [...held, name].join(',') })
  releaseOnExit()
  return code
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2))
}
