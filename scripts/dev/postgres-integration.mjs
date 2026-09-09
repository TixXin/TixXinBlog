/** @file postgres-integration.mjs @description 独立 Compose 项目验证数据库冷启动与配置拒绝，清理仅限本次项目 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, symlinkSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { workspace } from './config.mjs'
import { startPostgres, checkDatabase, run } from './checks.mjs'

const project = `tixxin-dev-pg-${Date.now()}-${process.pid}`
const directory = join(workspace, '.artifacts/dev-postgres', project)
mkdirSync(join(directory, 'src'), { recursive: true })
const source = join(workspace, 'src/backend/server-main')
cpSync(join(source, 'src/migrations'), join(directory, 'src/migrations'), { recursive: true })
writeFileSync(join(directory, 'package.json'), '{"name":"dev-database-check"}\n')
symlinkSync(
  join(source, 'node_modules'),
  join(directory, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
)
const listener = createServer()
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise((resolve) => listener.close(resolve))
const password = randomBytes(20).toString('hex')
const url = `postgres://dev:${password}@127.0.0.1:${port}/dev_startup`
const env = { ...process.env, COMPOSE_PROJECT_NAME: project, DATABASE_URL: url }
const file = join(directory, 'docker-compose.yml')
writeFileSync(
  file,
  `name: ${project}\nservices:\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: dev\n      POSTGRES_PASSWORD: ${password}\n      POSTGRES_DB: dev_startup\n    ports:\n      - '127.0.0.1:${port}:5432'\n    volumes:\n      - data:/var/lib/postgresql/data\nvolumes:\n  data:\n`,
)
const args = ['compose', '--project-directory', directory, '-f', file]
const config = { api: { directory, env }, database: new URL(url) }
let owned = false,
  connected = false,
  mismatchRejected = false,
  readyPortProtected = false
try {
  assert.equal(await run('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]), '')
  assert.equal(
    await run('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]),
    '',
  )
  owned = true
  const mismatched = new URL(url)
  mismatched.pathname = '/wrong_database'
  await assert.rejects(startPostgres({ ...config, database: mismatched }), /配置不一致/)
  mismatchRejected = true
  await startPostgres(config)
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await checkDatabase(config)
    if (result.connected) {
      connected = true
      assert(result.pending.length > 0)
      break
    }
    await delay(500)
  }
  assert(connected, 'PostgreSQL 冷启动未就绪')
  await assert.rejects(startPostgres(config), /端口已在监听/)
  readyPortProtected = true
} finally {
  if (owned) await run('docker', [...args, 'down', '--volumes'], { env, timeout: 30000 })
  writeFileSync(file, '# 本次隔离 Compose 验证已结束，临时凭据已移除。\n')
  const cleaned =
    (await run('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`])) === '' &&
    (await run('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`])) === ''
  const result = { connected, mismatchRejected, readyPortProtected, cleaned }
  writeFileSync(join(directory, 'result.json'), JSON.stringify(result, null, 2))
  assert(cleaned)
  process.stdout.write(JSON.stringify(result) + '\n')
}
