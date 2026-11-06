/**
 * @file restart.mjs
 * @description dev:terminal --restart 用：找到本启动器登记的服务进程（.artifacts/dev/<会话>/session.json）并请求它退出。
 *              只停进程命令确实是 scripts/dev.mjs、模式与要重启的一端一致的记录；手动起的或其他程序占用的端口不碰。
 *              供共用 dev 出现“端口通但页面坏了”（如依赖升级后模块报错）时由任一会话安全重启。
 * @author TixXin
 * @since 2026-11-06
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** 从会话记录里挑出要重启的那一端：模式一致、进程仍在、最新的一条 */
export function findOwnedSession(sessions, mode, isOurs) {
  return sessions
    .filter((session) => session.mode === mode && Number.isInteger(session.pid) && isOurs(session.pid))
    .sort((a, b) => b.startedAt - a.startedAt)[0]
}

function readSessions(workspace) {
  const dir = join(workspace, '.artifacts/dev')
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name, 'session.json')
    if (!existsSync(file)) return []
    try {
      return [{ ...JSON.parse(readFileSync(file, 'utf8')), startedAt: Number(name.split('-')[0]) || 0 }]
    } catch {
      return []
    }
  })
}

/** 进程命令是本仓库（而不是其他项目同名脚本）的 scripts/dev.mjs */
export function isWorkspaceSupervisor(command, workspace) {
  return command.includes(`${workspace}/scripts/dev.mjs `) && /scripts\/dev\.mjs\s+(api|web|all)\b/.test(command)
}

function processCommand(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
  } catch {
    return ''
  }
}

/** 请求本启动器登记的服务退出，返回被停止的进程号；没有可停的记录时抛错 */
export function stopOwnedService(workspace, mode) {
  const session = findOwnedSession(readSessions(workspace), mode, (pid) =>
    isWorkspaceSupervisor(processCommand(pid), workspace),
  )
  if (!session) throw new Error('没有找到本启动器启动的进程，不能自动重启；请在原终端窗口按 Ctrl+C 后重试')
  // dev.mjs 收到 SIGTERM 会清理自己的子进程组后退出
  process.kill(session.pid, 'SIGTERM')
  return session.pid
}
