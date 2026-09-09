/** @file run-data-command.ts @description 开发数据统一入口；检查只读，既有写入继续经过确认和备份 */
import { checkDevelopmentData } from './check-development-data'
import { DATA_DOMAINS } from './development-data-catalog'

async function main() {
  const [action, ...args] = process.argv.slice(2)
  if (action === 'seed-data') {
    const { seedDevelopmentData } = await import('./seed-development-data')
    const result = await seedDevelopmentData(args)
    if (!result.preview && !result.ready) process.exitCode = 1
    return
  }
  if (action !== 'check-data') {
    const { runDevDatabase } = await import('./database-dev')
    await runDevDatabase([action ?? 'status', ...args])
    return
  }
  let domain: string | undefined, search: string | undefined
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--domain' && !domain && DATA_DOMAINS.some((item) => item.id === args[index + 1]))
      domain = args[++index]
    else if (args[index] === '--search' && search === undefined && args[index + 1] !== undefined)
      search = args[++index]!.slice(0, 200)
    else
      throw new Error(
        '用法：db:dev check-data [--domain posts|comments|flashes|moments|media|site|guestbook] [--search 搜索词]；检查不接受写入参数',
      )
  }
  if (search !== undefined && !domain) throw new Error('搜索检查需同时提供 --domain')
  const result = await checkDevelopmentData(domain, search)
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (!result.ready) process.exitCode = 1
}
void main().catch((error) => {
  const safe =
    error instanceof Error &&
    (/^(用法：|搜索检查)/.test(error.message) ||
      ['DevDatabaseError', 'DevelopmentDataError'].includes(error.constructor.name))
  process.stderr.write(
    (safe ? error.message : '开发数据检查或操作未完成，请运行 dev:check 核对配置、连接、权限及迁移；未自动重试写入。') +
      '\n',
  )
  process.exitCode = 1
})
