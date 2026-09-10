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
import { FIXTURE_TABLES } from './fixture-ledger'
import type { FixtureKind } from './fixture-ledger'
import { submissionHash } from '../modules/moment/moment-values'

export async function removeDevelopmentData(
  args: string[],
  write = (value: string) => process.stdout.write(value + '\n'),
  options: DevelopmentBackupOptions = {},
) {
  let dataset = '',
    apply = false,
    confirm = ''
  for (let index = 0; index < args.length; index++) {
    if (
      args[index] === '--dataset' &&
      !dataset &&
      ['core-v1', 'guestbook-v1', 'gallery-v1', 'project-v1', 'all'].includes(args[index + 1] ?? '')
    )
      dataset = args[++index]!
    else if (args[index] === '--apply' && !apply) apply = true
    else if (args[index] === '--confirm' && !confirm && args[index + 1]) confirm = args[++index]!
    else
      throw new DevelopmentDataError(
        '用法：db:dev remove-data --dataset core-v1|guestbook-v1|gallery-v1|project-v1|all [--apply --confirm 数据库名]',
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
      ...plan,
    }
    write(JSON.stringify(report, null, 2))
    if (!apply || !plan.remove.length) return report
    await requireIdle(orm.em.fork(), application)
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
        'guestbook-reaction',
        'post-like',
        'flash-like',
        'moment-like',
        'comment',
        'flash-comment',
        'moment-comment',
        'guestbook',
        'gallery',
        'project',
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
      em.create(AuditEntry, {
        action: 'development.remove-data',
        resourceType: 'dataset',
        resourceId: dataset,
        actorName: '本机开发工具',
        state: 'success',
        summary: { fields: [], counts: { removed: current.remove.length, preserved: current.preserve.length } },
        finishedAt: new Date(),
      })
      await em.flush()
    })
    write(
      '指定样本清理完成；已编辑内容、外部互动、归属账本与图片文件保留。重新启动服务并刷新页面后使用新的内容上下文。',
    )
    return { ...report, backup: backup.directory }
  } finally {
    await orm.close(true)
  }
}
