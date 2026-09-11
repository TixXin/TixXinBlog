/** @file production-integration.mjs @description 唯一 Docker 项目中的生产 HTTPS、原生 worker 备份、恢复与发布失败验收。 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { request as httpsRequest } from 'node:https'
import { mkdir, readFile, writeFile, copyFile, lstat, readdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { resolve, join, dirname, basename, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { executeRelease, root } from './release.mjs'
import { cleanupProductionArtifacts } from './production-artifact-cleanup.mjs'
import { restoreFullBackup, verifyRestoredApplication } from '../../src/backend/server-main/scripts/full-backup.mjs'

const prefix = `tixxin-production-smoke-${Date.now()}-${process.pid}`
const directory = join(root, '.artifacts/production-release', prefix)
const context = join(directory, 'build-context')
const envFile = join(directory, 'production.env')
const overrideFile = join(directory, 'compose.override.json')
const certificateFile = join(directory, 'localhost-root.crt')
const repositories = Object.fromEntries(
  ['web', 'api', 'migration', 'worker'].map((role) => [role, `${prefix}-${role}`]),
)
const version = 'v1',
  nextVersion = 'v2',
  failedVersion = 'rejected'
const tags = []
const secretValues = [randomBytes(32).toString('hex'), randomBytes(48).toString('hex'), randomBytes(24).toString('hex')]
const [databasePassword, accessSecret, adminPassword] = secretValues
const report = { id: prefix, startedAt: new Date().toISOString(), stages: [], images: {}, assertions: {}, cleanup: {} }
let restored,
  certificate,
  currentVersion = version,
  workerEnabled = false
await mkdir(directory, { recursive: true })
const redact = (value) => secretValues.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
async function save() {
  await writeFile(join(directory, 'verification-report.json'), JSON.stringify(report, null, 2) + '\n')
}
async function run(program, args, env = process.env, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(program, args, { cwd: root, windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '',
      stderr = ''
    const log = options.log ? createWriteStream(join(directory, options.log), { flags: 'w' }) : null
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      log?.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      log?.write(chunk)
    })
    child.once('error', reject)
    child.once('close', (code) => {
      log?.end()
      if (code === 0) resolveResult(stdout.trim())
      else {
        const error = new Error(`${program} ${args[0]} failed (${code})`)
        error.detail = redact(stderr).slice(-4000)
        reject(error)
      }
    })
    child.stdin.end(options.input)
  })
}
async function stage(name, action) {
  report.stage = name
  await save()
  process.stdout.write(`生产隔离验收：${name}\n`)
  const value = await action()
  report.stages.push({ name, passedAt: new Date().toISOString() })
  await save()
  return value
}
async function port() {
  const server = createServer()
  await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady))
  const number = server.address().port
  await new Promise((resolveClosed) => server.close(resolveClosed))
  return number
}
const httpsPort = await port(),
  httpPort = await port()
const origin = `https://localhost:${httpsPort}`
const values = {
  RELEASE_PROJECT: prefix,
  RELEASE_VERSION: version,
  WEB_IMAGE_REPOSITORY: repositories.web,
  API_IMAGE_REPOSITORY: repositories.api,
  MIGRATION_IMAGE_REPOSITORY: repositories.migration,
  WORKER_IMAGE_REPOSITORY: repositories.worker,
  POSTGRES_IMAGE: 'postgres:16-alpine',
  CADDY_IMAGE: 'caddy:2-alpine',
  POSTGRES_PASSWORD: databasePassword,
  JWT_ACCESS_SECRET: accessSecret,
  SITE_HOST: `localhost:${httpsPort}`,
  SITE_URL: origin,
  HTTPS_BIND_ADDRESS: '127.0.0.1',
  HTTPS_PORT: String(httpsPort),
  HTTP_PORT: String(httpPort),
  OPERATIONS_WORKER_ENABLED: 'false',
  BACKUP_SCHEDULE_ENABLED: 'true',
  BACKUP_OWNER_ID: randomUUID(),
  BACKUP_INTERVAL_MINUTES: '1440',
  NOTIFICATION_EMAIL_ENABLED: 'false',
  NOTIFICATION_SMTP_HOST: '',
  NOTIFICATION_SMTP_USER: '',
  NOTIFICATION_SMTP_PASSWORD: '',
  NOTIFICATION_EMAIL_FROM: '',
  NOTIFICATION_EMAIL_TO: '',
  BACKUP_TRANSFER_URL: '',
  BACKUP_TRANSFER_TOKEN: '',
}
const cleanEnvironment = { ...process.env }
for (const key of Object.keys(cleanEnvironment))
  if (Object.hasOwn(values, key) || key.startsWith('COMPOSE_')) delete cleanEnvironment[key]
async function writeEnvironment() {
  await writeFile(
    envFile,
    Object.entries({ ...values, OPERATIONS_WORKER_ENABLED: String(workerEnabled) })
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  )
}
async function writeOverride(migrationFails = false) {
  const services = {
    edge: {
      volumes: [
        { type: 'bind', source: join(directory, 'Caddyfile'), target: '/etc/caddy/Caddyfile', read_only: true },
      ],
    },
  }
  if (migrationFails) services.migration = { command: ['node', '-e', 'process.exit(23)'] }
  await writeFile(overrideFile, JSON.stringify({ services }, null, 2))
}
const composeBase = [
  'compose',
  '--env-file',
  envFile,
  '-f',
  join(root, 'compose.production.yaml'),
  '-f',
  overrideFile,
  '--profile',
  'maintenance',
  '--profile',
  'worker',
]
const compose = (args, extra = {}) =>
  run('docker', [...composeBase, ...args], { ...cleanEnvironment, RELEASE_VERSION: currentVersion, ...extra })
const databaseQuery = (source) =>
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'tixxin', '-d', 'tixxin_blog', '-Atc', source])
async function volumeInventory() {
  const names = (await run('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${prefix}`]))
    .split('\n')
    .filter(Boolean)
    .sort()
  return Promise.all(
    names.map(async (name) => {
      const [volume] = JSON.parse(await run('docker', ['volume', 'inspect', name]))
      assert.equal(volume.Labels['com.docker.compose.project'], prefix)
      return { name, createdAt: volume.CreatedAt }
    }),
  )
}
async function container(service) {
  const id = await compose(['ps', '-a', '-q', service])
  assert(/^[a-f0-9]{12,64}$/.test(id), `容器未唯一就绪：${service}`)
  return id
}
async function inside(service, source, extra = {}) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      ...Object.keys(extra).flatMap((key) => ['-e', key]),
      await container(service),
      'node',
      '--input-type=module',
    ],
    { ...cleanEnvironment, ...extra },
    { input: source },
  )
}
async function worker(command, extra = {}) {
  return compose(
    ['run', '--rm', '--no-deps', '-T', ...Object.keys(extra).flatMap((key) => ['-e', key]), 'worker', ...command],
    extra,
  )
}
const operations = async (args, extra = {}) =>
  JSON.parse(await worker(['node', 'scripts/operations.mjs', ...args], extra))
async function trustCertificate() {
  if (certificate) return certificate
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const pem = await run('docker', [
        'exec',
        await container('edge'),
        'cat',
        '/data/caddy/pki/authorities/local/root.crt',
      ])
      assert(pem.includes('BEGIN CERTIFICATE'))
      certificate = pem
      await writeFile(certificateFile, pem)
      return certificate
    } catch {
      await delay(250)
    }
  }
  throw new Error('隔离内部 CA 未就绪')
}
async function secureFetch(url, options = {}) {
  const request = new Request(url, options)
  const body = Buffer.from(await request.arrayBuffer())
  const ca = await trustCertificate()
  return new Promise((resolveResponse, reject) => {
    const outgoing = httpsRequest(
      url,
      { method: request.method, headers: Object.fromEntries(request.headers), ca, family: 4, signal: options.signal },
      (response) => {
        if (!response.socket.authorized) {
          response.resume()
          reject(new Error('必须真实验证内部 CA，不能跳过 TLS 检查'))
          return
        }
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('error', reject)
        response.on('end', () => {
          const headers = new Headers()
          for (const [key, value] of Object.entries(response.headers))
            if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
          resolveResponse(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }))
        })
      },
    )
    outgoing.on('error', reject)
    outgoing.setTimeout(15000, () => outgoing.destroy(new Error('HTTPS 请求超时')))
    outgoing.end(body)
  })
}
async function release(targetVersion, options = {}) {
  currentVersion = targetVersion
  const calls = []
  const result = await executeRelease(
    { action: 'deploy', apply: true, origin, envFile, version: targetVersion, ...options },
    {
      fetch: secureFetch,
      command: async (program, args, env) => {
        const actual = [...args]
        if (program === 'docker' && actual[0] === 'compose')
          actual.splice(actual.indexOf('--profile'), 0, '-f', overrideFile)
        calls.push({
          program,
          operation: actual.find((value) => ['up', 'stop', 'run', 'verify'].includes(value)) ?? 'inspect',
        })
        return run(program, actual, env)
      },
    },
  )
  return { result, calls }
}
async function freezeSource() {
  const git = await run('git', ['rev-parse', 'HEAD'])
  assert.equal(await run('git', ['status', '--porcelain']), '', '生产隔离验收必须从已提交的干净检出运行')
  await mkdir(context)
  const listed = (await run('git', ['ls-files', '-c', '-z'])).split('\0').filter(Boolean)
  const paths = [...new Set(listed)]
    .filter(
      (path) =>
        ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'Dockerfile', '.dockerignore'].includes(path) ||
        path.startsWith('patches/') ||
        path.startsWith('src/'),
    )
    .filter(
      (path) =>
        !path
          .split('/')
          .some((part) => ['node_modules', 'dist', '.dev-dist', '.output', '.nuxt', '.nuxt-production'].includes(part)),
    )
    .filter((path) => !/^\.env(?:\.|$)/.test(basename(path)) || basename(path) === '.env.example')
  const hash = createHash('sha256')
  for (const path of paths.sort()) {
    const source = resolve(root, path),
      target = resolve(context, path)
    assert(source.startsWith(root + sep) && target.startsWith(context + sep))
    assert((await lstat(source)).isFile(), '构建快照不跟随符号链接')
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
    hash.update(path).update(await readFile(target))
  }
  assert.equal(await run('git', ['rev-parse', 'HEAD']), git, '冻结期间提交发生变化')
  assert.equal(await run('git', ['status', '--porcelain']), '', '冻结期间工作区发生变化')
  report.source = {
    git,
    dirty: false,
    trackedOnly: true,
    files: paths.length,
    sha256: hash.digest('hex'),
  }
}
let dailyPostgres
try {
  dailyPostgres = await run('docker', ['inspect', '--format', '{{.Id}}', 'tixxin-blog-postgres']).catch(() => '')
  await stage('冻结统一源码快照', freezeSource)
  await writeEnvironment()
  await writeFile(
    join(directory, 'Caddyfile'),
    `https://localhost {\n tls internal\n header X-TixXin-Release {$RELEASE_VERSION}\n reverse_proxy frontend:3000\n}\nhttp://localhost {\n redir ${origin}{uri} 308\n}\n`,
  )
  await writeOverride()
  await stage('构建四类生产镜像', async () => {
    for (const role of ['api', 'migration', 'worker', 'web']) {
      const tag = `${repositories[role]}:${version}`
      tags.push(tag)
      await run(
        'docker',
        [
          'build',
          '--progress=plain',
          '-f',
          join(context, role === 'web' ? 'Dockerfile' : 'src/backend/server-main/Dockerfile'),
          '--target',
          role === 'api' || role === 'web' ? 'runtime' : role,
          '-t',
          tag,
          context,
        ],
        process.env,
        { log: `build-${role}.log` },
      )
      report.images[role] = await run('docker', ['image', 'inspect', '--format', '{{.Id}}', tag])
      for (const alias of [nextVersion, failedVersion]) {
        const next = `${repositories[role]}:${alias}`
        await run('docker', ['tag', tag, next])
        tags.push(next)
      }
      await save()
    }
  })
  await stage('实际首次发布与受信任的本机 HTTPS', async () => {
    const { result } = await release(version, { initialize: true })
    assert.equal(result.status, 'ready')
    assert.equal(result.workerWasRunning, false)
    assert.equal((await compose(['ps', '--services', '--status', 'running'])).includes('worker'), false)
    const homepage = await secureFetch(origin)
    assert.equal(homepage.status, 200)
    assert.equal(homepage.headers.get('x-tixxin-release'), version)
    const redirect = await fetch(`http://localhost:${httpPort}/`, { redirect: 'manual' })
    assert.equal(redirect.status, 308)
    assert.equal(redirect.headers.get('location'), origin + '/')
    report.assertions.httpsVerified = true
    report.assertions.defaultWorkerStopped = true
  })
  let token, oldContext, media, post, postDigest, mediaDigest, operationGeneration
  await stage('生产身份与非空内容、媒体及关联', async () => {
    await run(
      'docker',
      [
        'exec',
        '-e',
        'ADMIN_DEFAULT_USERNAME',
        '-e',
        'ADMIN_DEFAULT_PASSWORD',
        await container('backend'),
        'node',
        'dist/admin-bootstrap.js',
      ],
      { ...cleanEnvironment, ADMIN_DEFAULT_USERNAME: 'production-smoke-owner', ADMIN_DEFAULT_PASSWORD: adminPassword },
    )
    const login = await secureFetch(origin + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username: 'production-smoke-owner', password: adminPassword }),
    })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('set-cookie'), /HttpOnly/)
    assert.match(login.headers.get('set-cookie'), /Secure/)
    token = (await login.json()).data.accessToken
    secretValues.push(token)
    const site = await secureFetch(origin + '/api/v1/site')
    oldContext = site.headers.get('x-content-context')
    const headers = { Authorization: `Bearer ${token}`, Origin: origin, 'X-Content-Context': oldContext }
    const png = await inside(
      'backend',
      "import {createRequire} from 'node:module';const require=createRequire(process.cwd()+'/package.json');const data=await require('sharp')({create:{width:90,height:60,channels:3,background:'#476985'}}).png().toBuffer();process.stdout.write(data.toString('base64'))",
    )
    const form = new FormData()
    form.append('file', new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }), '蓝色横向构图.png')
    form.append('alt', '蓝色横向构图')
    const upload = await secureFetch(origin + '/api/v1/admin/media', { method: 'POST', headers, body: form })
    assert.equal(upload.status, 201)
    media = (await upload.json()).data
    async function write(path, body, method = 'POST') {
      const response = await secureFetch(origin + '/api/v1' + path, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      assert(response.ok, `${path} 未成功：${response.status}`)
      return (await response.json()).data
    }
    await write(`/admin/media/${media.id}`, { description: '用于发布前内容与备份校验的蓝色构图' }, 'PATCH')
    const gallery = await write('/admin/gallery', {
      requestId: randomUUID(),
      title: '蓝色构图',
      mediaId: media.id,
      status: 'published',
    })
    const project = await write('/admin/projects', {
      requestId: randomUUID(),
      title: '博客的发布与维护',
      description: '同源 API、持久化媒体与版本化发布。',
      coverMediaId: media.id,
      status: 'published',
    })
    post = await write('/admin/posts', {
      title: '发布前记录',
      summary: '记录一次完整的内容、图片与发布验证。',
      contentRaw: `# 发布前记录\n\n![蓝色构图](${media.url})\n\n数据库、媒体与文章关联分别持久化。`,
      cover: media.url,
      status: 'published',
      relatedContent: [
        { type: 'project', id: project.id },
        { type: 'gallery', id: gallery.id },
      ],
    })
    const detail = await secureFetch(origin + `/api/v1/posts/${post.id}`)
    const publicPost = (await detail.json()).data
    assert.equal(publicPost.relatedContent.length, 2)
    postDigest = createHash('sha256').update(JSON.stringify(publicPost)).digest('hex')
    const image = await secureFetch(origin + media.url)
    assert.equal(image.headers.get('content-type'), 'image/webp')
    mediaDigest = createHash('sha256')
      .update(Buffer.from(await image.arrayBuffer()))
      .digest('hex')
    // 通过真实公开写入生成暂停邮件任务，恢复验证不能只检查空队列上的开关。
    const guestbook = await secureFetch(origin + '/api/v1/guestbook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-Content-Context': oldContext,
        'X-Visitor-Id': randomUUID(),
      },
      body: JSON.stringify({
        requestId: randomUUID(),
        author: '青禾',
        content: '看到这里的发布步骤，想了解恢复后如何保护未完成的任务。',
      }),
    })
    assert.equal(guestbook.status, 201)
    assert.equal(await databaseQuery("select count(*) from background_task where kind='mail' and state='paused'"), '1')
    operationGeneration = (await operations(['status'])).control.generation
    report.assertions.content = { posts: 1, gallery: 1, projects: 1, managedMedia: 1, structuredRelations: 2 }
    report.assertions.nonemptyPausedMailQueue = true
  })
  let backupDirectory
  await stage('一次性 worker 与发布互斥', async () => {
    const id = await compose([
      'run',
      '-d',
      '--rm',
      '--no-deps',
      '--name',
      `${prefix}-oneoff-probe`,
      'worker',
      'node',
      '-e',
      'setTimeout(()=>process.exit(0),30000)',
    ])
    try {
      await assert.rejects(release(version, { apply: false }), /一次性运行任务/)
      report.assertions.oneoffDoesNotEnablePersistentWorker = true
    } finally {
      await run('docker', ['rm', '-f', id]).catch(() => {})
    }
  })
  await stage('worker 原生 PG16 与完整备份校验', async () => {
    assert.match(await worker(['pg_dump', '--version']), /PostgreSQL\) 16\./)
    assert.equal(await worker(['pnpm', '--version']), '9.15.0')
    assert.equal(await worker(['node', '-e', 'process.stdout.write(String(process.getuid()))']), '1000')
    const readonly = await worker([
      'node',
      '-e',
      "try{require('node:fs').writeFileSync('/app/var/media/not-allowed','x');process.exit(2)}catch(e){if(e.code!=='EROFS')process.exit(3);process.stdout.write('read-only')}",
    ])
    assert.equal(readonly, 'read-only')
    const status = await operations(['status'])
    assert.equal(status.control.external_paused, true)
    assert.equal(status.config.email.enabled, false)
    await operations(['enable', '--kind', 'backup', '--revision', String(status.control.revision), '--apply'])
    const scheduled = await operations(['schedule', '--apply'])
    assert.equal(scheduled.state, 'queued')
    assert.equal((await operations(['schedule', '--apply'])).state, 'paused_or_existing')
    const completed = await operations(['run-once', '--kind', 'backup', '--apply'])
    assert.equal(completed.state, 'succeeded')
    assert.equal(completed.taskId, scheduled.taskId)
    const backupPath = `/app/var/backups/backup-${scheduled.taskId}-1`
    await worker(['node', 'scripts/full-backup.mjs', 'verify', '--directory', backupPath])
    const copier = await run('docker', [
      'create',
      '--name',
      `${prefix}-backup-copy`,
      '--label',
      `tixxin.production-smoke=${prefix}`,
      '-v',
      `${prefix}_backups:/app/var/backups:ro`,
      `${repositories.worker}:${version}`,
    ])
    try {
      backupDirectory = join(directory, 'backup')
      await mkdir(backupDirectory)
      await run('docker', ['cp', `${copier}:${backupPath}/.`, backupDirectory])
    } finally {
      await run('docker', ['rm', copier])
    }
    const manifest = JSON.parse(await readFile(join(backupDirectory, 'manifest.json'), 'utf8'))
    assert.equal(manifest.media.length, 1)
    assert.equal(manifest.counts.post, 1)
    assert(manifest.counts.site_settings_revision > 0, '完整备份必须包含非空站点历史')
    assert(manifest.counts.owner_notification > 0, '完整备份必须包含真实通知事件')
    report.assertions.nativeBackup = {
      pgMajor: 16,
      nodeUid: 1000,
      databaseBytes: manifest.database.bytes,
      mediaFiles: manifest.media.length,
      tables: Object.keys(manifest.counts).length,
      taskId: scheduled.taskId,
      generated: true,
      integrityVerified: true,
    }
  })
  await stage('完整恢复与恢复后应用验证', async () => {
    restored = await restoreFullBackup(backupDirectory, { output: join(directory, 'restored') })
    assert.equal(restored.report.rowDigestsVerified, true)
    assert.equal(restored.report.operationSafety.externalDeliveryPaused, true)
    assert.equal(restored.report.operationSafety.automaticBackupPaused, true)
    assert.equal(restored.report.operationSafety.restoredMailTasks, 1)
    assert(restored.report.operationSafety.interruptedBackupTasks > 0)
    assert.equal(restored.report.operationSafety.generationRotated, true)
    const connection = new URL(restored.connection.databaseUrl)
    const queue = JSON.parse(
      await run(
        'docker',
        [
          'exec',
          '-e',
          'PGPASSWORD',
          restored.connection.container,
          'psql',
          '-U',
          connection.username,
          '-d',
          connection.pathname.slice(1),
          '-Atc',
          `select json_build_object(
            'generation',generation,'externalPaused',external_paused,'backupPaused',backup_paused,
            'activeTasks',(select count(*) from background_task where state in ('queued','retry','running','paused')),
            'restoredMail',(select count(*) from background_task where kind='mail' and state='restored'),
            'recoveryRecords',(select count(*) from background_task where result->>'recoveryVerified'='true')
          ) from operation_control where id='default'`,
        ],
        { ...cleanEnvironment, PGPASSWORD: decodeURIComponent(connection.password) },
      ),
    )
    assert.notEqual(queue.generation, operationGeneration)
    assert.equal(queue.externalPaused, true)
    assert.equal(queue.backupPaused, true)
    assert.equal(queue.activeTasks, 0)
    assert.equal(queue.restoredMail, 1)
    assert.equal(queue.recoveryRecords, 1)
    const application = await verifyRestoredApplication(
      restored,
      `${repositories.api}:${version}`,
      randomBytes(48).toString('hex'),
      token,
      { username: 'production-smoke-owner', password: adminPassword, oldContext },
    )
    assert.equal(application.ready, true)
    assert.equal(application.freshLoginVerified, true)
    assert.equal(application.oldAuthorizationRejected, true)
    assert.equal(application.mediaVerified, 1)
    assert.equal(application.publicPosts, 1)
    assert.equal(application.publicGalleryPhotos, 1)
    assert.equal(application.publicProjects, 1)
    assert.equal(application.galleryOldContextRejected, true)
    assert.equal(application.projectOldContextRejected, true)
    report.assertions.restore = {
      ...application,
      rowDigestsVerified: true,
      operationSafety: restored.report.operationSafety,
      historicalQueueVerified: true,
    }
  })
  await stage('已有 worker 的发布协调与版本标識', async () => {
    workerEnabled = true
    await writeEnvironment()
    await compose(['up', '-d', '--no-build', '--pull', 'never', 'worker'])
    const before = await container('worker')
    const { result } = await release(nextVersion, { backupDirectory })
    assert.equal(result.workerWasRunning, true)
    assert.equal(result.workerRestarted, true)
    assert.notEqual(await container('worker'), before)
    assert.equal((await secureFetch(origin + '/api/v1/posts?pageSize=1')).headers.get('x-tixxin-release'), nextVersion)
    report.assertions.workerReleaseCoordinated = true
    await compose(['stop', 'worker'])
    workerEnabled = false
    await writeEnvironment()
  })
  await stage('真实迁移任务失败与跳过迁移的应用回退', async () => {
    const volumesBefore = await volumeInventory()
    assert(volumesBefore.length >= 5, '发布前必须已有独立数据库、媒体、证书、配置及备份卷')
    const before = await compose([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'tixxin',
      '-d',
      'tixxin_blog',
      '-Atc',
      'select count(*) from mikro_orm_migrations',
    ])
    await writeOverride(true)
    await assert.rejects(release(failedVersion, { backupDirectory }))
    const releaseReports = await readdir(join(root, '.artifacts/release', prefix))
    const failures = await Promise.all(
      releaseReports
        .filter((name) => name.endsWith('.json'))
        .map(async (name) => JSON.parse(await readFile(join(root, '.artifacts/release', prefix, name), 'utf8'))),
    )
    assert(
      failures.some(
        (item) => item.version === failedVersion && item.status === 'failed' && item.failedStage === 'migrating',
      ),
      '必须确认注入的迁移任务实际失败',
    )
    const running = await compose(['ps', '--services', '--status', 'running'])
    assert(!running.split('\n').includes('backend'))
    assert(!running.split('\n').includes('frontend'))
    assert(!running.split('\n').includes('worker'))
    assert.deepEqual(await volumeInventory(), volumesBefore, '失败不能替换或删除既有持久化卷')
    const { result, calls } = await release(version, { action: 'rollback', databaseCompatible: true, backupDirectory })
    assert.equal(result.status, 'ready')
    assert(!calls.some((call) => call.operation === 'run'), '回退不能执行迁移容器')
    assert.equal(
      await compose([
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'tixxin',
        '-d',
        'tixxin_blog',
        '-Atc',
        'select count(*) from mikro_orm_migrations',
      ]),
      before,
    )
    assert.equal((await secureFetch(origin + '/api/v1/posts?pageSize=1')).headers.get('x-tixxin-release'), version)
    assert.deepEqual(await volumeInventory(), volumesBefore, '应用回退不能重建持久化卷')
    const detail = await secureFetch(origin + `/api/v1/posts/${post.id}`)
    assert.equal(detail.status, 200)
    assert.equal(
      createHash('sha256')
        .update(JSON.stringify((await detail.json()).data))
        .digest('hex'),
      postDigest,
    )
    const image = await secureFetch(origin + media.url)
    assert.equal(image.status, 200)
    assert.equal(
      createHash('sha256')
        .update(Buffer.from(await image.arrayBuffer()))
        .digest('hex'),
      mediaDigest,
    )
    report.assertions.rollback = {
      migrationSkipped: true,
      migrationRowsUnchanged: true,
      previousVersion: nextVersion,
      restoredVersion: version,
      sameSourceAliases: true,
      persistentVolumesPreserved: true,
      contentAndMediaPreserved: true,
    }
  })
  await stage('数据库故障恢复与原生备份失败反馈', async () => {
    await compose(['stop', 'postgres'])
    assert.equal(
      await inside(
        'backend',
        "const response=await fetch('http://127.0.0.1:3000/ready');process.stdout.write(String(response.status))",
      ),
      '503',
    )
    await compose(['up', '-d', '--no-build', '--pull', 'never', '--wait', 'postgres'])
    const response = await secureFetch(origin + '/api/v1/posts?pageSize=1')
    assert.equal(response.status, 200)
    const scheduled = await operations(['schedule', '--apply'], { BACKUP_INTERVAL_MINUTES: '1' })
    assert.equal(scheduled.state, 'queued')
    const failed = await operations(['run-once', '--kind', 'backup', '--apply'], {
      BACKUP_DIRECTORY: '/dev/null/not-a-directory',
    })
    assert.equal(failed.state, 'retry')
    assert.equal(failed.errorCode, 'backup_execution_failed')
    report.assertions.failureHandling = {
      databaseUnavailable: 503,
      databaseRecovered: 200,
      backupFailureRecorded: failed.state,
      backupErrorCode: failed.errorCode,
    }
  })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = { stage: report.stage, message: redact(error.message), detail: error.detail }
  process.exitCode = 1
} finally {
  if (restored)
    await restored.cleanup().catch((error) => {
      report.cleanup.restoreError = redact(error.message)
    })
  const ownedContainers = [
    ...new Set(
      (
        await Promise.all([
          run('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${prefix}`]).catch(() => ''),
          run('docker', ['ps', '-aq', '--filter', `label=tixxin.production-smoke=${prefix}`]).catch(() => ''),
        ])
      )
        .join('\n')
        .split('\n')
        .filter(Boolean),
    ),
  ]
  for (const id of ownedContainers) {
    const project = await run('docker', [
      'inspect',
      '--format',
      '{{index .Config.Labels "com.docker.compose.project"}}',
      id,
    ]).catch(() => '')
    const owned =
      project === prefix ||
      prefix ===
        (await run('docker', ['inspect', '--format', '{{index .Config.Labels "tixxin.production-smoke"}}', id]).catch(
          () => '',
        ))
    if (owned)
      await run('docker', ['rm', '-f', id]).catch((error) => {
        report.cleanup.containerError = error.message
      })
  }
  const volumes = (
    await run('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${prefix}`]).catch(
      () => '',
    )
  )
    .split('\n')
    .filter(Boolean)
  for (const name of volumes)
    if (name.startsWith(prefix + '_'))
      await run('docker', ['volume', 'rm', name]).catch((error) => {
        report.cleanup.volumeError = error.message
      })
  const networks = (
    await run('docker', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${prefix}`]).catch(
      () => '',
    )
  )
    .split('\n')
    .filter(Boolean)
  for (const id of networks)
    await run('docker', ['network', 'rm', id]).catch((error) => {
      report.cleanup.networkError = error.message
    })
  for (const tag of tags.reverse())
    if (
      tag.startsWith(prefix + '-') &&
      (await run('docker', ['image', 'inspect', '--format', '{{.Id}}', tag]).catch(() => ''))
    )
      await run('docker', ['image', 'rm', tag]).catch((error) => {
        report.cleanup.imageError = error.message
      })
  report.cleanup.projectContainersRemaining = await run('docker', [
    'ps',
    '-aq',
    '--filter',
    `label=com.docker.compose.project=${prefix}`,
  ]).catch(() => 'unknown')
  report.cleanup.ownedContainersRemaining = await run('docker', [
    'ps',
    '-aq',
    '--filter',
    `label=tixxin.production-smoke=${prefix}`,
  ]).catch(() => 'unknown')
  report.cleanup.projectImageTagsRemaining = await run('docker', [
    'image',
    'ls',
    '--format',
    '{{.Repository}}:{{.Tag}}',
    '--filter',
    `reference=${prefix}-*`,
  ]).catch(() => 'unknown')
  if (restored) {
    const restoreId = restored.connection.container.slice('tixxin-restore-'.length)
    report.cleanup.restoreContainersRemaining = await run('docker', [
      'ps',
      '-aq',
      '--filter',
      `label=tixxin.restore.id=${restoreId}`,
    ]).catch(() => 'unknown')
    report.cleanup.restoreVolumesRemaining = await run('docker', [
      'volume',
      'ls',
      '-q',
      '--filter',
      `label=tixxin.restore.id=${restoreId}`,
    ]).catch(() => 'unknown')
  }
  report.cleanup.projectVolumesRemaining = await run('docker', [
    'volume',
    'ls',
    '-q',
    '--filter',
    `label=com.docker.compose.project=${prefix}`,
  ]).catch(() => 'unknown')
  report.cleanup.projectNetworksRemaining = await run('docker', [
    'network',
    'ls',
    '-q',
    '--filter',
    `label=com.docker.compose.project=${prefix}`,
  ]).catch(() => 'unknown')
  report.cleanup.dailyPostgresPreserved =
    !dailyPostgres ||
    dailyPostgres === (await run('docker', ['inspect', '--format', '{{.Id}}', 'tixxin-blog-postgres']).catch(() => ''))
  try {
    Object.assign(report.cleanup, await cleanupProductionArtifacts(directory))
  } catch (error) {
    report.cleanup.payloadsRemoved = false
    report.cleanup.environmentRemoved = false
    report.cleanup.artifactCleanupError = redact(error.message)
  }
  report.finishedAt = new Date().toISOString()
  if (
    Object.entries(report.cleanup).some(([key, value]) =>
      key.endsWith('Error') ? !!value : key.endsWith('Remaining') ? !!value : value === false,
    )
  ) {
    report.status = 'cleanup-failed'
    process.exitCode = 1
  }
  await save()
  process.stdout.write(
    JSON.stringify(
      {
        status: report.status,
        stage: report.stage,
        report: join(directory, 'verification-report.json'),
        cleanup: report.cleanup,
      },
      null,
      2,
    ) + '\n',
  )
}
