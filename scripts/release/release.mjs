/**
 * @file release.mjs
 * @description 显式环境、版本和完整备份约束下发布；默认只读预检，失败不自动逆迁移。
 */
import { spawn } from 'node:child_process'
import { readFile, mkdir, open, writeFile, unlink, stat } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const versionPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/

export function parseOptions(args) {
  const options = { action: 'deploy', apply: false, databaseCompatible: false, initialize: false }
  const names = {
    '--env-file': 'envFile',
    '--version': 'version',
    '--origin': 'origin',
    '--backup-directory': 'backupDirectory',
    '--action': 'action',
  }
  for (let index = 0; index < args.length; index++) {
    const value = args[index]
    if (value === '--apply') options.apply = true
    else if (value === '--initialize') options.initialize = true
    else if (value === '--database-compatible') options.databaseCompatible = true
    else if (names[value] && args[index + 1] && !args[index + 1].startsWith('--')) {
      if (Object.hasOwn(options, names[value]) && names[value] !== 'action') throw new Error('参数重复')
      options[names[value]] = args[++index]
    } else throw new Error('未知参数或缺少参数值')
  }
  if (!options.envFile || !options.version || !versionPattern.test(options.version))
    throw new Error('必须提供 --env-file 和有效的 --version')
  if (['latest', 'replace-with-git-sha'].includes(options.version)) throw new Error('必须使用可追溯的固定发布版本')
  let origin
  try {
    origin = new URL(options.origin)
  } catch {
    throw new Error('必须提供 --origin https://站点域名')
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('站点入口必须是无凭据、无路径和查询的 HTTPS 地址')
  options.origin = origin.origin
  if (!['deploy', 'rollback'].includes(options.action)) throw new Error('action 只能为 deploy 或 rollback')
  if (options.action === 'rollback' && !options.databaseCompatible)
    throw new Error('应用回退必须先确认当前数据库与目标版本兼容，再指定 --database-compatible')
  if (options.initialize && (options.action !== 'deploy' || options.backupDirectory))
    throw new Error('全新安装不能与回退或已有备份发布混用')
  if (options.apply && !options.backupDirectory && !options.initialize)
    throw new Error('执行前必须提供已完成的 --backup-directory')
  options.envFile = resolve(options.envFile)
  if (options.backupDirectory) options.backupDirectory = resolve(options.backupDirectory)
  return options
}

/** 子进程输出仅交给调用者解析；异常不包含可能携带秘密的 stderr 或参数。 */
export function command(program, args, env) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(program, args, {
      cwd: root,
      windowsHide: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
      if (output.length > 8 * 1024 * 1024) child.kill()
    })
    child.stderr.on('data', () => {})
    child.on('error', () => reject(new Error('发布依赖命令无法执行')))
    child.on('close', (code) =>
      code === 0 ? resolveResult(output.trim()) : reject(new Error(`发布命令失败（退出码 ${code}）`)),
    )
  })
}

export function validateConfiguration(config, options) {
  const services = config.services
  if (!/^[a-z0-9][a-z0-9_-]+$/.test(config.name ?? '')) throw new Error('需要稳定的独立 Compose 项目名称')
  if (!services?.backend || !services.frontend || !services.migration || !services.edge || !services.postgres)
    throw new Error('生产服务配置不完整')
  if (
    services.frontend.environment?.NUXT_PUBLIC_SITE_URL !== options.origin ||
    services.backend.environment?.CORS_ORIGIN !== options.origin ||
    services.edge.environment?.SITE_HOST !== new URL(options.origin).host
  )
    throw new Error('SITE_HOST、SITE_URL 和 --origin 必须一致')
  const databasePassword = services.postgres.environment?.POSTGRES_PASSWORD
  if (!/^[a-fA-F0-9]{32,}$/.test(databasePassword ?? '')) throw new Error('数据库密码必须为至少 32 位随机十六进制值')
  const secret = services.backend.environment?.JWT_ACCESS_SECRET
  if (typeof secret !== 'string' || secret.length < 32 || secret.startsWith('replace-'))
    throw new Error('签名密钥尚未正确配置')
  const images = Object.fromEntries(
    ['frontend', 'backend', 'migration', 'postgres', 'edge'].map((name) => [name, services[name].image]),
  )
  for (const name of ['frontend', 'backend', 'migration'])
    if (!images[name]?.endsWith(`:${options.version}`)) throw new Error('应用与迁移必须采用同一明确版本')
  return { project: config.name, images }
}

export async function executeRelease(options, dependencies = {}) {
  const run = dependencies.command ?? command
  const fetchResponse = dependencies.fetch ?? fetch
  // 使用显式文件作为插值来源；清除 shell 中可能覆盖生产配置的同名变量。
  const envText = await readFile(options.envFile, 'utf8')
  const composeText = await readFile(join(root, 'compose.production.yaml'), 'utf8')
  const env = { ...process.env }
  for (const match of envText.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) delete env[match[1]]
  for (const match of composeText.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)) delete env[match[1]]
  for (const key of Object.keys(env)) if (key.startsWith('COMPOSE_')) delete env[key]
  env.RELEASE_VERSION = options.version
  const base = [
    'compose',
    '--env-file',
    options.envFile,
    '-f',
    join(root, 'compose.production.yaml'),
    '--profile',
    'maintenance',
    '--profile',
    'worker',
  ]
  const compose = (...args) => run('docker', [...base, ...args], env)
  let config
  try {
    config = JSON.parse(await compose('config', '--format', 'json'))
  } catch {
    throw new Error('Compose 配置校验失败，请在受控终端核对环境与 Docker 状态')
  }
  const result = validateConfiguration(config, options)
  const imageIds = {}
  for (const [name, image] of Object.entries(result.images)) {
    const id = await run('docker', ['image', 'inspect', '--format', '{{.Id}}', image], env)
    if (!/^sha256:[a-f0-9]{64}$/.test(id)) throw new Error('镜像未在本机就绪，请先构建或取得已验证镜像')
    imageIds[name] = id
  }
  const runningWorkers = config.services.worker
    ? await run(
        'docker',
        [
          'ps',
          '--filter',
          `label=com.docker.compose.project=${result.project}`,
          '--filter',
          'label=com.docker.compose.service=worker',
          '--format',
          '{{.ID}}',
        ],
        env,
      )
    : ''
  let workerWasRunning = false
  for (const id of runningWorkers.split(/\s+/).filter(Boolean)) {
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('运行任务容器标识不合法')
    const labels = JSON.parse(await run('docker', ['inspect', '--format', '{{json .Config.Labels}}', id], env))
    if (String(labels['com.docker.compose.oneoff']).toLowerCase() === 'true')
      throw new Error('此项目仍有一次性运行任务，请等待其完成后再发布')
    workerWasRunning = true
  }
  const restartWorker = workerWasRunning && config.services.worker.environment?.OPERATIONS_WORKER_ENABLED === 'true'
  if (restartWorker) {
    const image = config.services.worker.image
    if (!image?.endsWith(`:${options.version}`)) throw new Error('已启用的运行任务必须使用本次同版本镜像')
    const id = await run('docker', ['image', 'inspect', '--format', '{{.Id}}', image], env)
    if (!/^sha256:[a-f0-9]{64}$/.test(id)) throw new Error('运行任务镜像未就绪')
    result.images.worker = image
    imageIds.worker = id
  }
  const report = {
    project: result.project,
    version: options.version,
    action: options.action,
    images: result.images,
    imageIds,
    status: 'preview',
    checkedAt: new Date().toISOString(),
    workerWasRunning,
    workerRestarted: false,
  }
  const requireEmptyInstallation = async () => {
    const containers = await run(
      'docker',
      ['ps', '-a', '--filter', `label=com.docker.compose.project=${result.project}`, '--format', '{{.ID}}'],
      env,
    )
    const volumeNames = (await run('docker', ['volume', 'ls', '--format', '{{.Name}}'], env)).split('\n')
    const targets = Object.values(config.volumes ?? {}).map((volume) => volume.name)
    if (
      targets.length < 4 ||
      new Set(targets).size !== targets.length ||
      targets.some((name) => !name || volumeNames.includes(name)) ||
      containers
    )
      throw new Error('全新安装要求此项目没有容器且所有目标持久化卷尚不存在')
  }
  if (options.initialize) {
    await requireEmptyInstallation()
    report.initialInstallation = true
  }
  if (!options.apply) return report
  if (!options.initialize) {
    if (!(await stat(options.backupDirectory)).isDirectory()) throw new Error('完整备份目录不存在')
    await run(
      process.execPath,
      [join(root, 'src/backend/server-main/scripts/full-backup.mjs'), 'verify', '--directory', options.backupDirectory],
      env,
    )
  }
  const artifacts = join(root, '.artifacts/release', result.project)
  await mkdir(artifacts, { recursive: true })
  const lockPath = join(artifacts, 'release.lock')
  let lock
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch {
    throw new Error('此项目已有发布锁；确认没有正在执行的发布后再人工处理锁文件')
  }
  const reportPath = join(artifacts, `${Date.now()}-${options.version}.json`)
  try {
    if (options.initialize) await requireEmptyInstallation()
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, version: options.version, startedAt: new Date().toISOString() }),
    )
    await writeFile(reportPath, JSON.stringify({ ...report, status: 'started' }, null, 2), { mode: 0o600 })
    report.status = 'starting-database'
    await compose('up', '-d', '--no-build', '--pull', 'never', '--wait', 'postgres')
    report.status = 'stopping-application'
    await compose('stop', 'frontend', 'backend', ...(workerWasRunning ? ['worker'] : []))
    if (options.action === 'deploy') {
      report.status = 'migrating'
      await compose('run', '--rm', '--no-deps', '--pull', 'never', 'migration')
    }
    report.status = 'starting-application'
    await compose('up', '-d', '--no-build', '--pull', 'never', '--wait', 'backend', 'frontend', 'edge')
    report.status = 'checking-entry'
    const response = await fetchResponse(`${options.origin}/api/v1/posts?pageSize=1`, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
    if (!response.ok || response.headers.get('x-tixxin-release') !== options.version)
      throw new Error('HTTPS 同源 API 或发布版本标识验证失败')
    if (restartWorker) {
      report.status = 'restarting-worker'
      await compose('up', '-d', '--no-build', '--pull', 'never', '--wait', 'worker')
      report.workerRestarted = true
    }
    report.status = 'ready'
    report.finishedAt = new Date().toISOString()
    await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
    return report
  } catch (error) {
    report.failedStage = report.status
    report.status = 'failed'
    report.finishedAt = new Date().toISOString()
    await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
    throw error
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await executeRelease(parseOptions(process.argv.slice(2)))
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } catch (error) {
    // 依赖异常可能含本机敏感路径，CLI 只输出已知业务错误与固定失败提示。
    process.stderr.write(
      `发布未完成：${error instanceof Error && !error.code ? error.message : '请核对配置文件与本地依赖'}。不自动回退迁移或删除数据。\n`,
    )
    process.exitCode = 1
  }
}
