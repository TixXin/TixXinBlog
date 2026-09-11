/** @file editorial-maintenance.ts @description 首发候选显式迁正：默认预览、完整备份、锁内再次核对，复用版本化保存并保持全草稿。 */
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { mikroOrmOptions } from '../config/mikro-orm.options'
import { Post } from '../entities/post.entity'
import { Project } from '../entities/project.entity'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { ProjectService } from '../modules/project/project.service'
import { lockTaxonomy } from '../modules/post/taxonomy-lock'
import { lockMedia } from '../modules/media/media-references'
import { createDevelopmentBackup } from './development-backup'
import type { DevelopmentBackupOptions } from './development-backup'
import { inspectEditorialContent } from './editorial-review'
import {
  editorialCandidates,
  editorialLedgerKey,
  editorialPostInput,
  editorialProjectInput,
  editorialRelations,
} from './editorial-model'
import { EDITORIAL_REFRESH_REASON } from './editorial-content'
import { fixtureHash, fixtureRow } from './fixture-ledger'

export function editorialTarget(apply: boolean, confirm = '') {
  const url = new URL(process.env.DATABASE_URL!)
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    ['postgres', 'template0', 'template1'].includes(database) ||
    (apply && (process.env.NODE_ENV === 'production' || confirm !== database))
  )
    throw new Error('首发候选工具仅处理已核对的本机数据库；写入需要非生产目标及精确确认')
  return { url, database, host: url.hostname, port: Number(url.port || 5432) }
}
export async function prepareEditorialContent(apply = false, confirm = '', options: DevelopmentBackupOptions = {}) {
  const target = editorialTarget(apply, confirm)
  const orm = await MikroORM.init({
    ...mikroOrmOptions,
    clientUrl: target.url.toString(),
    ensureDatabase: false,
    debug: false,
    migrations: { ...mikroOrmOptions.migrations, snapshot: false },
  })
  try {
    const plan = await inspectEditorialContent(orm.em.fork())
    const report = {
      target: { database: target.database, host: target.host, port: target.port },
      apply,
      ...plan,
      changed: false,
      updated: [] as string[],
      status: 'draft',
    }
    if (!apply || !plan.eligible || plan.ready) return report
    if (
      (await orm.getMigrator().getPendingMigrations()).length ||
      (await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()
    )
      throw new Error('请先显式完成迁移；首发候选整理不会隐式迁移')
    const backup = await createDevelopmentBackup(options)
    const updated = await orm.em.fork().transactional(async (em) => {
      await lockTaxonomy(em)
      await lockMedia(em)
      await em.execute('select pg_advisory_xact_lock(742919)')
      for (const candidate of editorialCandidates) {
        const current =
          candidate.kind === 'post'
            ? await em.findOne(Post, { id: plan.ids[candidate.key] }, { lockMode: LockMode.PESSIMISTIC_WRITE })
            : await em.findOne(Project, { id: plan.ids.tixxinblog }, { lockMode: LockMode.PESSIMISTIC_WRITE })
        if (!current) return null
      }
      const current = await inspectEditorialContent(em)
      if (!current.eligible || current.fingerprint !== plan.fingerprint) return null
      const posts = new AdminPostService(em, new PostRevisionsService(em)),
        projects = new ProjectService(em),
        updated: string[] = []
      for (const candidate of current.items) {
        if (candidate.stage === 'ready') continue
        const relatedContent = editorialRelations(current.ids, candidate.key)
        if (candidate.kind === 'post')
          await posts.save(
            candidate.id!,
            { ...editorialPostInput(candidate.key, relatedContent), revision: candidate.revision! },
            EDITORIAL_REFRESH_REASON,
          )
        else
          await projects.save(candidate.id!, {
            ...editorialProjectInput(relatedContent),
            revision: candidate.revision!,
          })
        const ledger = await em.findOneOrFail(DevelopmentFixture, { key: editorialLedgerKey(candidate.key) })
        ledger.snapshotHash = fixtureHash((await fixtureRow(em, candidate.kind, String(candidate.id)))!)
        updated.push(candidate.key)
      }
      await em.flush()
      return updated
    })
    if (!updated)
      return { ...report, eligible: false, backup: backup.directory, reason: '备份期间候选发生变化，保留全部当前内容' }
    const verified = await inspectEditorialContent(orm.em.fork())
    if (!verified.ready) throw new Error('首发候选保存后核查失败，请保留备份并检查当前版本')
    return { ...report, ...verified, backup: backup.directory, changed: updated.length > 0, updated }
  } finally {
    await orm.close(true)
  }
}
