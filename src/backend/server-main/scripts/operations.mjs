/** @file operations.mjs @description 显式运行任务 CLI；默认预览，不随 HTTP 启动，不执行迁移或补种。 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const require = createRequire(import.meta.url)
const backend = fileURLToPath(new URL('../', import.meta.url))
async function main() {
  process.chdir(backend)
  require('../dist/config/environment.js').loadLocalEnvironment(backend)
  const { readOperationConfig, operationConfigStatus } = require('../dist/modules/operations/operation-config.js')
  const { runTaskOnce, scheduleBackup, setOperationPaused } = require('../dist/modules/operations/task-runner.js')
  const { MikroORM } = require('@mikro-orm/postgresql')
  const { mikroOrmOptions } = require('../dist/config/mikro-orm.options.js')
  const [action = 'status', ...args] = process.argv.slice(2)
  if (!['status', 'run-once', 'schedule', 'enable', 'pause', 'loop'].includes(action))
    throw new Error('unsupported_action')
  const options = {}
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--apply') options.apply = true
    else if (['--kind', '--revision'].includes(args[index]) && args[index + 1])
      options[args[index].slice(2)] = args[++index]
    else throw new Error('invalid_arguments')
  }
  const kind = options.kind
  if (['run-once', 'enable', 'pause'].includes(action) && !['mail', 'backup'].includes(kind))
    throw new Error('kind_required')
  const revision = Number(options.revision)
  if (['enable', 'pause'].includes(action) && (!Number.isSafeInteger(revision) || revision < 0))
    throw new Error('revision_required')
  const config = readOperationConfig()
  const orm = await MikroORM.init({ ...mikroOrmOptions, debug: false })
  try {
    const [control] = await orm.em
      .fork()
      .execute(
        "select generation,external_paused,backup_paused,revision,reason,last_mail_at,updated_at from operation_control where id='default'",
      )
    if (!options.apply || action === 'status') {
      process.stdout.write(
        JSON.stringify(
          { action, preview: action !== 'status', config: operationConfigStatus(config), control },
          null,
          2,
        ) + '\n',
      )
      return
    }
    let result
    if (action === 'enable' || action === 'pause') {
      const setting = kind === 'mail' ? config.email : config.backup
      if (action === 'enable' && (!setting.enabled || setting.missing.length))
        throw new Error('configuration_not_enabled')
      result = await setOperationPaused(orm, kind, action === 'pause', revision)
    } else if (action === 'schedule') result = await scheduleBackup(orm, config)
    else if (action === 'run-once') result = await runTaskOnce(orm, config, kind)
    else {
      if (!config.workerEnabled) throw new Error('worker_not_enabled')
      let stopping = false
      const stop = () => {
        stopping = true
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
      try {
        while (!stopping) {
          await scheduleBackup(orm, config)
          for (const taskKind of ['backup', 'mail']) {
            if (stopping) break
            const outcome = await runTaskOnce(orm, config, taskKind)
            if (outcome.taskId) process.stdout.write(JSON.stringify(outcome) + '\n')
          }
          if (!stopping) await delay(1000)
        }
      } finally {
        process.removeListener('SIGINT', stop)
        process.removeListener('SIGTERM', stop)
      }
      result = { stopped: true }
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } finally {
    await orm.close(true)
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    process.stderr.write('运行操作未完成，请核对显式配置、数据库迁移和命令参数；未显示底层连接信息。\n')
    process.exitCode = 1
  })
