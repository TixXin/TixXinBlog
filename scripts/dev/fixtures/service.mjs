/** @file service.mjs @description 启动器回归专用进程：就绪、延迟、失败和孙进程 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const mode = process.env.DEV_FIXTURE_MODE
const started = Date.now()
if (process.argv.includes('--grandchild')) {
  setInterval(() => {}, 1000)
} else {
  const child = spawn(process.execPath, [process.argv[1], '--grandchild'], { stdio: 'ignore', windowsHide: true })
  writeFileSync(
    process.env.DEV_FIXTURE_PIDS,
    JSON.stringify({ parent: process.pid, child: child.pid, argument: process.argv[2] }),
  )
  // 故意跨 chunk 输出，用来校验完整行脱敏。
  const secret = process.env.TEST_SECRET ?? ''
  process.stdout.write(secret.slice(0, 4))
  setTimeout(() => process.stdout.write(secret.slice(4) + '\n'), 20)
  if (mode === 'exit') setTimeout(() => process.exit(2), 150)
  else
    setTimeout(
      () =>
        createServer((req, res) => {
          res.setHeader('content-type', 'application/json')
          if (req.url === '/identity' && mode === 'warming' && Date.now() - started < 1200) {
            res.statusCode = 503
            res.end('{}')
          } else if (req.url === '/identity')
            res.end(
              JSON.stringify({
                service: 'fixture',
                workspace: 'fixture-workspace',
                pid: process.pid,
                session: process.env.TIXXIN_DEV_SESSION ?? null,
              }),
            )
          else {
            res.statusCode = mode === 'unhealthy' ? 503 : 200
            res.end(JSON.stringify({ status: 'ok' }))
          }
        }).listen(Number(process.env.DEV_FIXTURE_PORT), '127.0.0.1'),
      Number(process.env.DEV_FIXTURE_DELAY ?? 0),
    )
}
