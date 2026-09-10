/** @file seed-development-data.ts @description 开发数据增量边界：显式确认、备份、事务、归属记录和受控媒体补偿 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { ConfigService } from '@nestjs/config'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { MediaAsset } from '../entities/media-asset.entity'
import { AuditEntry } from '../entities/audit-entry.entity'
import { LocalMediaStorage } from '../modules/media/media-storage'
import { lockTaxonomy } from '../modules/post/taxonomy-lock'
import { lockMedia } from '../modules/media/media-references'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import type { FixtureProgress } from './fixture-ledger'
import { DEFAULT_DEVELOPMENT_DATASET, DEVELOPMENT_DATASETS, DEVELOPMENT_DATASET_NAMES } from './development-datasets'

export class DevelopmentDataError extends Error {}
export async function seedDevelopmentData(
  args: string[],
  write = (value: string) => process.stdout.write(value + '\n'),
  options: DevelopmentBackupOptions = {},
) {
  let dataset = DEFAULT_DEVELOPMENT_DATASET,
    apply = false,
    confirm = ''
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--dataset' && [...DEVELOPMENT_DATASET_NAMES, 'all'].includes(args[index + 1] ?? ''))
      dataset = args[++index]!
    else if (args[index] === '--apply' && !apply) apply = true
    else if (args[index] === '--confirm' && !confirm && args[index + 1]) confirm = args[++index]!
    else
      throw new DevelopmentDataError(
        `用法：db:dev seed-data --dataset ${DEVELOPMENT_DATASET_NAMES.join('|')}|all [--apply --confirm 数据库名]`,
      )
  }
  const url = new URL(process.env.DATABASE_URL!)
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    apply &&
    (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      process.env.NODE_ENV === 'production' ||
      confirm !== database ||
      ['postgres', 'template0', 'template1'].includes(database))
  )
    throw new DevelopmentDataError('只允许确认后的本机非生产开发数据库，未执行写入')
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: url.toString(),
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  const storage = new LocalMediaStorage(new ConfigService(process.env))
  const createdMedia: string[] = []
  try {
    const [{ table }] = await orm.em
      .getConnection()
      .execute<{ table: string | null }[]>('select to_regclass(\'public.development_fixture\') as "table"')
    const existing = table ? await orm.em.fork().count(DevelopmentFixture, dataset === 'all' ? {} : { dataset }) : 0
    const selected = DEVELOPMENT_DATASETS.filter((item) => dataset === 'all' || item.id === dataset)
    const plan = {
      dataset,
      target: { database, host: url.hostname, port: Number(url.port || 5432) },
      existingOwnershipRecords: existing,
      expectedRecords: selected.reduce((total, item) => total + item.count, 0),
      datasets: selected.map((item) => ({ id: item.id, expectedRecords: item.count })),
      scope: selected.map((item) => item.scope).join('；') + '；已有归属不覆盖、不复活',
      apply,
    }
    write(JSON.stringify(plan, null, 2))
    if (!apply) return { ...plan, ready: false, preview: true }
    if (
      !table ||
      (await orm.getMigrator().getPendingMigrations()).length ||
      (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
    )
      throw new DevelopmentDataError('请先核对并执行 migration:up，数据集不会隐式迁移或重建数据库')
    const backup = await createDevelopmentBackup(options)
    write(`写入前完整备份：${backup.directory}`)
    const progress: FixtureProgress = { created: [], retained: [], unavailable: [] }
    try {
      await orm.em.fork().transactional(async (em) => {
        await em.execute("set local lock_timeout='5s'")
        await lockTaxonomy(em)
        await lockMedia(em)
        await em.execute('select pg_advisory_xact_lock(742919)')
        for (const item of selected) await item.seed(em, storage, progress, createdMedia)
        em.create(AuditEntry, {
          action: 'development.seed-data',
          resourceType: 'dataset',
          resourceId: dataset,
          actorName: '本机开发工具',
          state: progress.unavailable.length ? 'partial' : 'success',
          summary: {
            fields: [],
            counts: {
              created: progress.created.length,
              retained: progress.retained.length,
              unavailable: progress.unavailable.length,
            },
          },
          finishedAt: new Date(),
        })
        await em.flush()
      })
    } catch (cause) {
      // 仅删除本次新生成且确认没有数据库记录的资源；无法核对提交结果时保留文件。
      for (const id of createdMedia)
        await orm.em
          .fork()
          .transactional(async (em) => {
            await lockMedia(em)
            if (!(await em.findOne(MediaAsset, { id })) && (await storage.readIfExists(`${id}.webp`)))
              await storage.remove(`${id}.webp`)
          })
          .catch(() => undefined)
      throw cause
    }
    const report = {
      ...plan,
      preview: false,
      backup: backup.directory,
      ready: progress.unavailable.length === 0,
      ...progress,
    }
    write(JSON.stringify(report, null, 2))
    return report
  } finally {
    await orm.close(true)
  }
}
