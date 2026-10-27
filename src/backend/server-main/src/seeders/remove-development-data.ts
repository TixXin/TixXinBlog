/** @file remove-development-data.ts @description 指定样本集的显式清理：默认预览、停止服务后备份、锁内重新核对，不删除归属账本和媒体文件 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { AuditEntry } from '../entities/audit-entry.entity'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import { requireIdle } from './database-dev'
import { DevelopmentDataError } from './seed-development-data'
import { fixtureCleanupPlan } from './fixture-cleanup-plan'
import { FIXTURE_TABLES, fixtureRow } from './fixture-ledger'
import type { FixtureKind } from './fixture-ledger'
import { VOLUME_DATASET_PREFIX } from './volume-constants'
import { submissionHash } from '../modules/moment/moment-values'
import { DEVELOPMENT_DATASET_NAMES } from './development-datasets'

export async function removeDevelopmentData(
  args: string[],
  write = (value: string) => process.stdout.write(value + '\n'),
  options: DevelopmentBackupOptions = {},
) {
  let dataset = '',
    apply = false,
    confirm = '',
    forget = false
  for (let index = 0; index < args.length; index++) {
    if (
      args[index] === '--dataset' &&
      !dataset &&
      [...DEVELOPMENT_DATASET_NAMES, 'all'].includes(args[index + 1] ?? '')
    )
      dataset = args[++index]!
    else if (args[index] === '--apply' && !apply) apply = true
    else if (args[index] === '--forget-ownership' && !forget) forget = true
    else if (args[index] === '--confirm' && !confirm && args[index + 1]) confirm = args[++index]!
    else
      throw new DevelopmentDataError(
        `用法：db:dev remove-data --dataset ${DEVELOPMENT_DATASET_NAMES.join('|')}|all [--forget-ownership] [--apply --confirm 数据库名]`,
      )
  }
  if (!dataset) throw new DevelopmentDataError('请显式指定需要清理的样本集 --dataset')
  const url = new URL(process.env.DATABASE_URL!),
    database = decodeURIComponent(url.pathname.slice(1))
  if (
    apply &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      process.env.NODE_ENV === 'production' ||
      confirm !== database ||
      ['postgres', 'template0', 'template1'].includes(database))
  )
    throw new DevelopmentDataError('仅允许确认后的本机非生产数据库，未执行清理')
  const application = `tixxin-fixture-cleanup-${randomUUID()}`
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: url.toString(),
    ensureDatabase: false,
    debug: false,
    pool: { min: 0, max: 2 },
    driverOptions: { connection: { application_name: application } },
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    if (
      (await orm.getMigrator().getPendingMigrations()).length ||
      (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
    )
      throw new DevelopmentDataError('请先核对迁移和结构，清理工具不会自动修改数据库结构')
    const plan = await fixtureCleanupPlan(orm.em.fork(), dataset)
    const report = {
      dataset,
      target: { database, host: url.hostname, port: Number(url.port || 5432) },
      preview: !apply,
      // 默认保留归属以防止补种复活；样本定义变更后需要重建时才显式清除。
      forgetOwnership: forget,
      ...plan,
    }
    write(JSON.stringify(report, null, 2))
    // 重建场景下记录可能已经删光、只剩归属，此时仍需进入事务清除归属。
    if (!apply || (!plan.remove.length && !forget)) return report
    await requireIdle(orm.em.fork(), application)
    const forgotten: string[] = []
    const backup = await createDevelopmentBackup(options)
    write(`清理前完整备份：${backup.directory}`)
    await requireIdle(orm.em.fork(), application)
    await orm.em.fork().transactional(async (em) => {
      await em.execute("set local lock_timeout='5s'")
      const tables = await em.execute<{ tablename: string }[]>(
        "select tablename from pg_tables where schemaname='public' order by tablename",
      )
      const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
      await em.execute(
        `lock table ${tables.map((item) => 'public.' + quote(item.tablename)).join(',')} in access exclusive mode nowait`,
      )
      await requireIdle(em, application)
      const current = await fixtureCleanupPlan(em, dataset)
      if (submissionHash(current) !== submissionHash(plan))
        throw new DevelopmentDataError('预览后的样本或引用已变化，未执行清理；请重新预览')
      const order: FixtureKind[] = [
        'task',
        'notification',
        'guestbook-reaction',
        'post-like',
        'flash-like',
        'moment-like',
        'comment',
        'flash-comment',
        'moment-comment',
        'guestbook',
        'gallery',
        'prompt',
        'project',
        'subscription',
        'link-application',
        'link',
        'moment',
        'flash',
        'post',
        'media',
      ]
      for (const kind of order) {
        for (const item of current.remove.filter((item) => item.kind === kind))
          await em.execute(`delete from public.${quote(FIXTURE_TABLES[kind])} where id=?`, [item.id])
      }
      await em.execute(
        "update post_tag set count=(select count(*) from post_tag_map m join post p on p.id=m.post_id where m.post_tag_id=post_tag.id and p.status='published' and p.deleted_at is null)",
      )
      await em.execute('update content_context set generation=?,require_context=true', [randomUUID()])
      // 只清除业务记录已经不存在的归属：仍被保留的记录继续受账本保护，不会因为本次重建被覆盖。
      // 代价是此前被删除的样本会在下次补种时重新创建，因此该开关只用于样本定义变更后的重建。
      if (forget) {
        const owned = await em.execute<{ key: string; kind: string; resource_id: string }[]>(
          dataset === 'all'
            ? 'select key,kind,resource_id from development_fixture where dataset not like ? order by key'
            : 'select key,kind,resource_id from development_fixture where dataset=? order by key',
          [dataset === 'all' ? `${VOLUME_DATASET_PREFIX}%` : dataset],
        )
        for (const row of owned) {
          if (!(row.kind in FIXTURE_TABLES)) continue
          if (await fixtureRow(em, row.kind as FixtureKind, row.resource_id)) continue
          await em.execute('delete from development_fixture where key=?', [row.key])
          forgotten.push(row.key)
        }
      }
      em.create(AuditEntry, {
        action: 'development.remove-data',
        resourceType: 'dataset',
        resourceId: dataset,
        actorName: '本机开发工具',
        state: 'success',
        summary: {
          fields: [],
          counts: {
            removed: current.remove.length,
            preserved: current.preserve.length,
            forgotten: forgotten.length,
          },
        },
        finishedAt: new Date(),
      })
      await em.flush()
    })
    write(
      forget
        ? `指定样本清理完成；已清除 ${forgotten.length} 条失去记录的归属，该数据集可以重新补种，此前被删除的样本也会随之重新创建。已编辑内容、外部互动与图片文件保留。重新启动服务并刷新页面后使用新的内容上下文。`
        : '指定样本清理完成；已编辑内容、外部互动、归属账本与图片文件保留。重新启动服务并刷新页面后使用新的内容上下文。',
    )
    return { ...report, backup: backup.directory, forgotten }
  } finally {
    await orm.close(true)
  }
}
