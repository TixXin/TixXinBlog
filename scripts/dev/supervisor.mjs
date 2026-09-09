/** @file supervisor.mjs @description 开发服务启动状态机；仅持有本次创建的服务句柄 */
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { join } from 'node:path'
import { startOwned } from './process.mjs'
import { inspectService } from './checks.mjs'

export function createSupervisor({
  services,
  directory,
  timeout = 90000,
  inspect = inspectService,
  start = startOwned,
  report = () => {},
}) {
  if (!Number.isFinite(timeout) || timeout < 100) throw new Error('启动超时必须为至少 100ms 的有效数字')
  const session = randomUUID()
  const owned = []
  const active = []
  let stopping = false
  let stopPromise
  async function close() {
    if (stopPromise) return stopPromise
    stopping = true
    stopPromise = (async () => {
      for (const handle of [...owned].reverse()) await handle.close()
      report('本次启动的服务已结束；复用服务与 PostgreSQL 保持运行')
    })()
    return stopPromise
  }
  async function launch() {
    try {
      // 全部端口先检查，避免已知冲突下仍启动另一项服务。
      for (const service of services) {
        const status = await inspect(service)
        if (status.state === 'foreign') throw new Error(`${service.name}：${status.detail}`)
        active.push({ service, reused: status.state !== 'stopped', identity: status.identity })
      }
      for (const entry of active) {
        if (stopping) throw new Error('启动已取消')
        const { service } = entry
        const logPath = join(directory, `${service.service}.log`)
        report(
          entry.reused ? `${service.name}：检查已有服务 ${service.origin}` : `${service.name}：启动中；日志 ${logPath}`,
        )
        const handle = entry.reused ? null : start(service, session, logPath)
        if (handle) owned.push(handle)
        const deadline = Date.now() + timeout
        while (!stopping) {
          if (handle?.ended) throw new Error(`${service.name}启动进程已退出，请查看 ${logPath}`)
          const status = await inspect(service)
          if (status.identity && (status.state === 'foreign' || (!entry.reused && status.identity.session !== session)))
            throw new Error(`${service.name}端口在启动期间被其他进程占用`)
          if (status.state === 'ready') {
            entry.identity = status.identity
            break
          }
          if (Date.now() >= deadline)
            throw new Error(`${service.name}就绪超时，${entry.reused ? '请检查原服务终端' : `请查看 ${logPath}`}`)
          await delay(200)
        }
        if (stopping) throw new Error('启动已取消')
        report(`${service.name}：${entry.reused ? '复用已就绪服务' : '已就绪'} ${service.origin}`)
      }
      return active
    } catch (error) {
      await close()
      throw error
    }
  }
  async function monitor(signal) {
    const failures = new Map()
    while (!stopping && !signal.aborted) {
      await delay(1500, undefined, { signal }).catch(() => {})
      if (stopping || signal.aborted) break
      for (const entry of active) {
        const status = await inspect(entry.service)
        const healthy = status.state === 'ready' && (entry.reused || status.identity.session === session)
        const since = failures.get(entry.service.service)
        if (healthy) {
          if (since) report(`${entry.service.name}：已恢复就绪`)
          failures.delete(entry.service.service)
        } else if (!since) {
          failures.set(entry.service.service, Date.now())
          report(`${entry.service.name}：暂未就绪，等待热重载或服务恢复`)
        }
        // 配置热重载可能重新编译，沿用明确的就绪时限；实际进程退出即时处理。
        if (
          (since && Date.now() - since >= timeout) ||
          owned.some((handle) => handle.ended) ||
          (status.state === 'foreign' && status.identity)
        ) {
          await close()
          throw new Error(`${entry.service.name}运行异常，请检查对应日志后重新启动`)
        }
      }
    }
  }
  return { session, launch, monitor, close }
}
