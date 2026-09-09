/** @file posix-host.mjs @description POSIX 服务进程组托管；父控制管道关闭时清理后代 */
import { spawn } from 'node:child_process'
const [directory, encoded] = process.argv.slice(2)
const child = spawn(process.execPath, JSON.parse(Buffer.from(encoded, 'base64').toString()), {
  cwd: directory,
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: process.env,
})
let stopping = false
async function close(code = 0) {
  if (stopping) return
  stopping = true
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      /* 已退出的进程组无需处理。 */
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* 后代均已退出。 */
    }
  }
  process.exit(code)
}
child.once('error', () => void close(1))
child.once('exit', (code) => void close(code || 1))
process.stdin.resume()
process.stdin.once('data', () => void close())
process.stdin.once('end', () => void close())
process.once('SIGINT', () => void close())
process.once('SIGTERM', () => void close())
