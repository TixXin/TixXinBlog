/** @file process.mjs @description 服务进程托管入口与按完整日志行脱敏 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { appendFileSync } from 'node:fs'
import { redact } from './config.mjs'

export function startOwned(service, session, logPath) {
  const encoded = Buffer.from(JSON.stringify([service.entry, ...service.args])).toString('base64')
  const command = process.platform === 'win32' ? 'powershell.exe' : process.execPath
  const args =
    process.platform === 'win32'
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          fileURLToPath(new URL('./windows-host.ps1', import.meta.url)),
          '-NodePath',
          process.execPath,
          '-Directory',
          service.directory,
          '-ArgumentsBase64',
          encoded,
        ]
      : [fileURLToPath(new URL('./posix-host.mjs', import.meta.url)), service.directory, encoded]
  const child = spawn(command, args, {
    cwd: service.directory,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...service.env, TIXXIN_DEV_SESSION: session },
  })
  let ended = false
  const closed = new Promise((resolve) => {
    child.once('error', () => {
      ended = true
      resolve()
    })
    child.once('close', () => {
      ended = true
      resolve()
    })
  })
  for (const stream of [child.stdout, child.stderr]) {
    let pending = ''
    const flush = (line) => appendFileSync(logPath, redact(line.replaceAll('\r', ''), service.env) + '\n')
    stream.on('data', (chunk) => {
      pending += chunk.toString()
      const lines = pending.split('\n')
      pending = lines.pop()
      lines.forEach(flush)
    })
    stream.on('end', () => {
      if (pending) flush(pending)
    })
  }
  child.stdin.on('error', () => {})
  return {
    service,
    child,
    logPath,
    get ended() {
      return ended
    },
    async close() {
      if (ended) return
      child.stdin.end('stop\n')
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 4000).unref())])
      // 强制结束托管器同样会关闭 Job 句柄；POSIX 托管器捕获 SIGTERM 清理进程组。
      if (!ended) child.kill('SIGTERM')
      await closed
    },
  }
}
