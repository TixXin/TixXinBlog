/** @file check-development-data.ts @description 复用启动器判断数据库与服务身份，再只读核对业务样本；失败不伪装为空数据 */
import { MikroORM } from '@mikro-orm/postgresql'
import { inspectDataCatalog } from './development-data-catalog'
import { readConfig } from '../../../../../scripts/dev/config.mjs'
import { checkDatabase, inspectService, json } from '../../../../../scripts/dev/checks.mjs'

export async function checkDevelopmentData(domain?: string, search?: string) {
  const config = readConfig()
  const target = {
    host: config.database.hostname,
    port: Number(config.database.port || 5432),
    database: decodeURIComponent(config.database.pathname.slice(1)),
  }
  const [database, api, web] = await Promise.all([
    checkDatabase(config),
    inspectService(config.api),
    inspectService(config.web),
  ])
  const services = {
    api: { state: api.state, address: config.api.origin, detail: api.detail },
    web: { state: web.state, address: config.web.origin, detail: web.detail },
  }
  if (!database.connected)
    return { ready: false, state: 'database-unavailable', target, services, repair: 'corepack pnpm dev:check' }
  if (database.pending.length)
    return {
      ready: false,
      state: 'pending-migrations',
      target,
      services,
      migrations: database.pending,
      repair: 'corepack pnpm --filter server-main migration:up',
    }
  let sameOrigin = false
  if (api.state === 'ready' && web.state === 'ready') {
    try {
      const proxied = await json(config.web.origin + '/__dev/data-source')
      sameOrigin = proxied.workspace === api.identity.workspace && proxied.database === api.identity.database
    } catch {
      /* 网关或归属不符作为独立故障报告。 */
    }
  }
  const orm = await MikroORM.init({
    clientUrl: config.api.env.DATABASE_URL,
    entities: [],
    discovery: { warnWhenNoEntities: false },
    ensureDatabase: false,
    debug: false,
    pool: { min: 0, max: 1 },
    driverOptions: { connection: { connectionTimeoutMillis: 3000, statement_timeout: 5000 } },
  })
  try {
    const catalog = await inspectDataCatalog(orm.em.fork(), domain, search)
    const state =
      api.state === 'foreign' || web.state === 'foreign'
        ? 'wrong-service-or-database'
        : api.state !== 'ready' || web.state !== 'ready'
          ? 'service-unavailable'
          : !sameOrigin
            ? 'gateway-mismatch'
            : catalog.ready
              ? 'ready'
              : 'missing-data'
    return {
      ...catalog,
      ready: state === 'ready',
      state,
      target,
      services,
      sameOrigin,
      explanation: '统计为开发数据覆盖检查；管理态可能包含非公开记录。筛选无匹配不代表数据库清空。',
      repair:
        state === 'missing-data'
          ? '按开发数据目录增量补齐缺失场景；不要清空现有数据'
          : state === 'ready'
            ? null
            : 'corepack pnpm dev:check',
    }
  } finally {
    await orm.close(true)
  }
}
