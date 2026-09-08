/**
 * @file full-backup.mjs
 * @description 本机 PostgreSQL 一致性备份与新容器恢复；所有恢复目标新建，绝不覆盖开发数据库。
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, join, dirname, sep } from 'node:path'
import { mkdir, readFile, writeFile, lstat, realpath, copyFile, chmod } from 'node:fs/promises'
import { createReadStream, createWriteStream, constants } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const require = createRequire(import.meta.url)
export const backendRoot = fileURLToPath(new URL('../', import.meta.url))
const repoRoot = resolve(backendRoot, '../../..')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const identifier = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/
const quote = (name) => `"${name.replaceAll('"', '""')}"`
const digest = async (path) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
async function directory(path) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true, mode: 0o700 })
  await mkdir(target, { mode: 0o700 })
  if ((await lstat(target)).isSymbolicLink() || (await realpath(target)) !== target)
    throw new Error('目标目录必须为新建的真实目录')
  return target
}
async function safeFile(root, relative) {
  const target = resolve(root, relative)
  if (!target.startsWith(root + sep)) throw new Error('备份路径越界')
  const stat = await lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('备份仅允许普通文件')
  const physical = await realpath(target)
  if (!physical.startsWith(root + sep)) throw new Error('备份文件越界')
  return target
}
function environment(extra = {}) {
  const env = { ...process.env }
  for (const key of Object.keys(env)) if (/JWT|API_KEY|ACCESS_TOKEN|DEFAULT_PASSWORD/i.test(key)) delete env[key]
  return { ...env, ...extra }
}
async function command(args, { output, env, input } = {}) {
  const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: environment(env) })
  let text = ''
  child.stderr.on('data', () => {
    /* 不将数据库行或连接凭据写入操作日志。 */
  })
  const operation =
    ['pg_dump', 'pg_restore', 'psql', 'pg_isready', 'sha256sum'].find((name) => args.includes(name)) || args[0]
  const done = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Docker ${operation} 操作失败（退出码 ${code}）`)),
    )
  })
  const writing = output
    ? pipeline(child.stdout, createWriteStream(output, { flags: 'wx', mode: 0o600 }))
    : new Promise((resolve) => {
        child.stdout.on('data', (data) => {
          text += data.toString()
          if (text.length > 64 * 1024 * 1024) child.kill()
        })
        child.stdout.once('end', resolve)
      })
  if (input) child.stdin.end(input)
  else child.stdin.end()
  await Promise.all([done, writing])
  return text.trim()
}
async function psql(container, database, user, password, sql) {
  return command(
    [
      'exec',
      '-e',
      'PGPASSWORD',
      container,
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-A',
      '-t',
      '-h',
      '127.0.0.1',
      '-U',
      user,
      '-d',
      database,
      '-c',
      sql,
    ],
    { env: { PGPASSWORD: password } },
  )
}
function localConfig() {
  process.chdir(backendRoot)
  require('../dist/config/environment.js').loadLocalEnvironment(backendRoot)
  const url = new URL(process.env.DATABASE_URL)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('此维护命令仅处理本机数据库')
  const database = decodeURIComponent(url.pathname.slice(1)),
    user = decodeURIComponent(url.username)
  if (!identifier.test(database) || !identifier.test(user)) throw new Error('数据库或用户名格式不支持')
  return {
    url,
    database,
    user,
    password: decodeURIComponent(url.password),
    media: resolve(process.env.MEDIA_DIRECTORY || './var/media'),
  }
}
export async function createFullBackup({
  output,
  container = process.env.BACKUP_POSTGRES_CONTAINER || 'tixxin-blog-postgres',
  onSnapshot,
  onProgress = () => {},
} = {}) {
  const source = localConfig()
  if (!/^[a-zA-Z0-9_.-]+$/.test(container)) throw new Error('容器名称不合法')
  const ports = JSON.parse(await command(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]))
  if (!(ports['5432/tcp'] ?? []).some((binding) => Number(binding.HostPort) === Number(source.url.port || 5432)))
    throw new Error('指定容器与本机数据库端口不匹配')
  const root = await directory(output || join(repoRoot, '.backups', `backup-${Date.now()}-${randomUUID().slice(0, 8)}`))
  await mkdir(join(root, 'media'), { mode: 0o700 })
  const { MikroORM } = require('@mikro-orm/postgresql')
  const { IsolationLevel } = require('@mikro-orm/core')
  const { mikroOrmOptions } = require('../dist/config/mikro-orm.options.js')
  const orm = await MikroORM.init({ ...mikroOrmOptions, clientUrl: source.url.toString(), debug: false })
  try {
    const manifest = await orm.em.fork().transactional(
      async (em) => {
        await em.execute("set local time zone 'UTC'")
        const [snapshot] = await em.execute(
          "select pg_export_snapshot() as id, current_setting('server_version_num') as version, clock_timestamp() as captured_at",
        )
        if (Math.floor(Number(snapshot.version) / 10000) !== 16) throw new Error('当前维护恢复流程需要 PostgreSQL 16')
        const tables = await em.execute("select tablename from pg_tables where schemaname='public' order by tablename")
        const counts = Object.create(null),
          rowDigests = Object.create(null)
        for (const { tablename } of tables) {
          const [value] = await em.execute(
            `select count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as digest from public.${quote(tablename)} t`,
          )
          counts[tablename] = Number(value.count)
          rowDigests[tablename] = value.digest
        }
        const assets = await em.execute(
          'select id,storage_key as key,sha256,byte_size as bytes from media_asset order by id',
        )
        const migrations = await em.execute('select name from mikro_orm_migrations order by id')
        onProgress({ stage: 'database', tables: tables.length })
        await onSnapshot?.()
        await command(
          [
            'exec',
            '-e',
            'PGPASSWORD',
            container,
            'pg_dump',
            '-h',
            '127.0.0.1',
            '-U',
            source.user,
            '-d',
            source.database,
            '--format=custom',
            '--no-owner',
            '--no-privileges',
            `--snapshot=${snapshot.id}`,
          ],
          { env: { PGPASSWORD: source.password }, output: join(root, 'database.dump') },
        )
        const media = []
        for (const asset of assets) {
          if (!uuid.test(asset.id) || asset.key !== `${asset.id}.webp`) throw new Error('媒体记录包含不支持的资源键')
          const original = await safeFile(await realpath(source.media), asset.key)
          if ((await lstat(original)).size !== asset.bytes || (await digest(original)) !== asset.sha256)
            throw new Error(`媒体完整性不符：${asset.id}`)
          const copied = join(root, 'media', asset.key)
          await copyFile(original, copied, constants.COPYFILE_EXCL)
          await chmod(copied, 0o600)
          if ((await digest(copied)) !== asset.sha256) throw new Error('复制后的媒体校验失败')
          media.push({ id: asset.id, key: asset.key, sha256: asset.sha256, bytes: asset.bytes })
          onProgress({ stage: 'media', done: media.length, total: assets.length })
        }
        return {
          format: 'tixxin-full-backup',
          version: 1,
          createdAt: new Date().toISOString(),
          snapshotAt: new Date(snapshot.captured_at).toISOString(),
          postgresMajor: 16,
          sourceDatabase: source.database,
          database: {
            file: 'database.dump',
            sha256: await digest(join(root, 'database.dump')),
            bytes: (await lstat(join(root, 'database.dump'))).size,
          },
          counts,
          rowDigests,
          migrations: migrations.map((item) => item.name),
          media,
        }
      },
      { isolationLevel: IsolationLevel.REPEATABLE_READ },
    )
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 })
    return { directory: root, manifest }
  } finally {
    await orm.close(true)
  }
}
export async function verifyFullBackup(path) {
  const root = await realpath(resolve(path))
  const manifestPath = await safeFile(root, 'manifest.json')
  if ((await lstat(manifestPath)).size > 64 * 1024 * 1024) throw new Error('备份清单过大')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (
    manifest.format !== 'tixxin-full-backup' ||
    manifest.version !== 1 ||
    manifest.postgresMajor !== 16 ||
    manifest.database?.file !== 'database.dump' ||
    !Array.isArray(manifest.media) ||
    !manifest.counts ||
    typeof manifest.counts !== 'object' ||
    Array.isArray(manifest.counts)
  )
    throw new Error('备份格式或版本不支持')
  if (
    !/^[a-f0-9]{64}$/.test(manifest.database.sha256) ||
    !Number.isSafeInteger(manifest.database.bytes) ||
    manifest.database.bytes < 1
  )
    throw new Error('数据库清单不合法')
  const database = await safeFile(root, 'database.dump')
  if ((await lstat(database)).size !== manifest.database.bytes || (await digest(database)) !== manifest.database.sha256)
    throw new Error('数据库备份校验失败')
  const ids = new Set()
  for (const media of manifest.media) {
    if (
      !uuid.test(media.id) ||
      media.key !== `${media.id}.webp` ||
      ids.has(media.id) ||
      !/^[a-f0-9]{64}$/.test(media.sha256) ||
      !Number.isSafeInteger(media.bytes) ||
      media.bytes < 1
    )
      throw new Error('媒体清单不合法')
    ids.add(media.id)
    const file = await safeFile(root, `media/${media.key}`)
    if ((await lstat(file)).size !== media.bytes || (await digest(file)) !== media.sha256)
      throw new Error(`媒体备份校验失败：${media.id}`)
  }
  for (const [table, count] of Object.entries(manifest.counts))
    if (!identifier.test(table) || !Number.isSafeInteger(count) || count < 0) throw new Error('表计数不合法')
  return { root, manifest }
}
export async function restoreFullBackup(path, { output } = {}) {
  const { root, manifest } = await verifyFullBackup(path)
  const target = await directory(
    output || join(repoRoot, '.backups', `restored-${Date.now()}-${randomUUID().slice(0, 8)}`),
  )
  const id = randomUUID()
  const container = `tixxin-restore-${id}`
  const volume = `tixxin-restore-data-${id}`
  const user = 'tixxin_restore',
    database = 'tixxin_restore',
    password = randomBytes(32).toString('base64url')
  let createdVolume = false,
    createdContainer = false
  const cleanup = async () => {
    if (createdContainer) {
      const label = await command([
        'inspect',
        '--format',
        '{{index .Config.Labels "tixxin.restore.id"}}',
        container,
      ]).catch(() => '')
      if (label === id) await command(['rm', '-f', container])
    }
    if (createdVolume) {
      const label = await command([
        'volume',
        'inspect',
        '--format',
        '{{index .Labels "tixxin.restore.id"}}',
        volume,
      ]).catch(() => '')
      if (label === id) await command(['volume', 'rm', volume])
    }
  }
  try {
    let image
    for (const candidate of ['postgres:16-alpine', 'postgres:16']) {
      try {
        await command(['image', 'inspect', candidate, '--format', '{{.Id}}'])
        image = candidate
        break
      } catch {
        /* 仅选择已在本机的官方 PostgreSQL 16 镜像。 */
      }
    }
    if (!image) throw new Error('请先准备本机 postgres:16-alpine 或 postgres:16 镜像')
    createdVolume = true
    await command(['volume', 'create', '--label', `tixxin.restore.id=${id}`, volume])
    createdContainer = true
    await command(
      [
        'run',
        '-d',
        '--pull=never',
        '--name',
        container,
        '--label',
        `tixxin.restore.id=${id}`,
        '-e',
        'POSTGRES_PASSWORD',
        '-e',
        `POSTGRES_USER=${user}`,
        '-e',
        `POSTGRES_DB=${database}`,
        '--network',
        'none',
        '-v',
        `${volume}:/var/lib/postgresql/data`,
        image,
      ],
      { env: { POSTGRES_PASSWORD: password } },
    )
    let ready = false
    for (let i = 0; i < 60; i++) {
      try {
        await command(['exec', container, 'pg_isready', '-U', user, '-d', database])
        ready = true
        break
      } catch {
        await delay(500)
      }
    }
    if (!ready) throw new Error('隔离恢复数据库未能就绪')
    await command(['cp', join(root, 'database.dump'), `${container}:/tmp/tixxin-restore.dump`])
    const copiedHash = (await command(['exec', container, 'sha256sum', '/tmp/tixxin-restore.dump'])).split(/\s/)[0]
    if (copiedHash !== manifest.database.sha256) throw new Error('容器中的数据库备份校验失败')
    await command(
      [
        'exec',
        '-e',
        'PGPASSWORD',
        container,
        'pg_restore',
        '-h',
        '127.0.0.1',
        '-U',
        user,
        '-d',
        database,
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-privileges',
        '/tmp/tixxin-restore.dump',
      ],
      { env: { PGPASSWORD: password } },
    )
    const counts = Object.create(null)
    for (const [table, expected] of Object.entries(manifest.counts)) {
      counts[table] = Number(
        await psql(container, database, user, password, `select count(*) from public.${quote(table)}`),
      )
      if (counts[table] !== expected) throw new Error(`恢复后表计数不符：${table}`)
      if (!/^[a-f0-9]{32}$/.test(manifest.rowDigests?.[table] ?? '')) throw new Error('缺少表内容摘要')
      const digest = (
        await psql(
          container,
          database,
          user,
          password,
          `set time zone 'UTC'; select md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) from public.${quote(table)} t`,
        )
      )
        .split('\n')
        .at(-1)
      if (digest !== manifest.rowDigests[table]) throw new Error(`恢复后表内容摘要不符：${table}`)
    }
    await mkdir(join(target, 'media'), { mode: 0o700 })
    for (const media of manifest.media) {
      const file = join(target, 'media', media.key)
      await copyFile(await safeFile(root, `media/${media.key}`), file, constants.COPYFILE_EXCL)
      await chmod(file, 0o600)
      if ((await digest(file)) !== media.sha256) throw new Error('恢复媒体校验失败')
    }
    // 完整恢复不能复活备份时的登录授权，旧页面也必须重新读取恢复后的数据。
    await psql(
      container,
      database,
      user,
      password,
      "update admin_user set session_version=session_version+1; update refresh_token set revoked_at=now() where revoked_at is null; update admin_session set revoked_at=now() where revoked_at is null; update content_context set generation=gen_random_uuid(),require_context=true where id='default';",
    )
    const connection = {
      databaseUrl: `postgresql://${user}:${password}@127.0.0.1:5432/${database}`,
      mediaDirectory: join(target, 'media'),
      container,
      volume,
      network: 'none',
    }
    await writeFile(join(target, 'connection.json'), JSON.stringify(connection, null, 2), { flag: 'wx', mode: 0o600 })
    const report = {
      restoredAt: new Date().toISOString(),
      source: root,
      container,
      network: 'none',
      counts,
      rowDigestsVerified: true,
      mediaFiles: manifest.media.length,
      revokedRestoredSessions: true,
      requireFreshContentContext: true,
      connectionFile: 'connection.json',
    }
    await writeFile(join(target, 'restore-report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 })
    return { directory: target, report, connection, cleanup }
  } catch (error) {
    await cleanup().catch(() => undefined)
    throw error
  }
}

export async function verifyRestoredApplication(
  restored,
  image,
  accessSecret = randomBytes(48).toString('hex'),
  oldToken = '',
) {
  if (!/^[a-z0-9][a-z0-9./:_-]+$/.test(image)) throw new Error('后端镜像名称不合法')
  const id = randomUUID(),
    container = `tixxin-restore-api-${id}`
  const connection = new URL(restored.connection.databaseUrl)
  const database = connection.pathname.slice(1),
    user = connection.username,
    password = connection.password
  const expected = Number(
    await psql(
      restored.connection.container,
      database,
      user,
      password,
      "select count(*) from post where status='published' and deleted_at is null",
    ),
  )
  const media = JSON.parse(
    await psql(
      restored.connection.container,
      database,
      user,
      password,
      "select coalesce(json_agg(x),'[]'::json) from (select id,sha256 from media_asset where deleted_at is null order by id limit 1) x",
    ),
  )
  try {
    await command(
      [
        'run',
        '-d',
        '--pull=never',
        '--name',
        container,
        '--label',
        `tixxin.restore.id=${id}`,
        '--network',
        `container:${restored.connection.container}`,
        '--user',
        String(process.getuid?.() ?? 1000),
        '-e',
        'DATABASE_URL',
        '-e',
        'JWT_ACCESS_SECRET',
        '-e',
        'NODE_ENV=production',
        '-e',
        'MEDIA_DIRECTORY=/app/var/media',
        '--mount',
        `type=bind,source=${restored.connection.mediaDirectory},target=/app/var/media,readonly`,
        image,
      ],
      { env: { DATABASE_URL: restored.connection.databaseUrl, JWT_ACCESS_SECRET: accessSecret } },
    )
    const source = `const crypto = require('node:crypto'); (async()=>{ const ready=await fetch('http://127.0.0.1:3000/ready'); if(!ready.ok)throw Error('ready'); const response=await fetch('http://127.0.0.1:3000/api/v1/posts?pageSize=1'); const body=await response.json(); if(response.status!==200||body.data.total!==${expected})throw Error('posts'); const media=${JSON.stringify(media)}; if(media.length){ const image=await fetch('http://127.0.0.1:3000/api/v1/media/'+media[0].id+'.webp'); if(!image.ok||crypto.createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex')!==media[0].sha256)throw Error('media'); } if(process.env.VERIFY_OLD_ACCESS_TOKEN){const denied=await fetch('http://127.0.0.1:3000/api/v1/admin/posts',{headers:{Authorization:'Bearer '+process.env.VERIFY_OLD_ACCESS_TOKEN}});if(denied.status!==401)throw Error('old token');} process.stdout.write(JSON.stringify({ready:true,publicPosts:body.data.total,mediaVerified:media.length,oldAuthorizationChecked:!!process.env.VERIFY_OLD_ACCESS_TOKEN,oldAuthorizationRejected:process.env.VERIFY_OLD_ACCESS_TOKEN?true:null})); })().catch(()=>process.exit(1))`
    for (let i = 0; i < 50; i++) {
      try {
        const result = await command(['exec', '-e', 'VERIFY_OLD_ACCESS_TOKEN', container, 'node', '-e', source], {
          env: { VERIFY_OLD_ACCESS_TOKEN: oldToken },
        })
        return JSON.parse(result)
      } catch {
        await delay(500)
      }
    }
    throw new Error('恢复后的后端接口验证未通过')
  } finally {
    const label = await command([
      'inspect',
      '--format',
      '{{index .Config.Labels "tixxin.restore.id"}}',
      container,
    ]).catch(() => '')
    if (label === id) await command(['rm', '-f', container])
  }
}

async function main() {
  const [action, ...args] = process.argv.slice(2)
  const option = (name) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  if (action === 'create') {
    const result = await createFullBackup({
      output: option('--output'),
      container: option('--container'),
      onProgress: (value) => {
        if (value.stage === 'database') process.stdout.write('一致快照已固定，正在导出数据库…\n')
        else if (value.done % 25 === 0 || value.done === value.total)
          process.stdout.write(`已复制校验媒体 ${value.done}/${value.total}\n`)
      },
    })
    process.stdout.write(
      `完整备份已生成：${result.directory}\n受管媒体 ${result.manifest.media.length} 个，数据库与文件校验通过\n`,
    )
  } else if (action === 'verify' && option('--directory')) {
    const result = await verifyFullBackup(option('--directory'))
    process.stdout.write(`校验通过：${result.root}\n`)
  } else if (action === 'restore' && option('--directory')) {
    const result = await restoreFullBackup(option('--directory'), { output: option('--output') })
    process.stdout.write(
      `已恢复到新建隔离容器（无外部网络）：${result.report.container}\n报告与本地连接配置：${result.directory}\n原数据库与媒体目录保留，尚未切换应用连接\n`,
    )
  } else
    throw new Error(
      '用法：full-backup.mjs create [--output 新目录] [--container 本机PG容器] | verify --directory 备份目录 | restore --directory 备份目录 [--output 新目录]',
    )
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
