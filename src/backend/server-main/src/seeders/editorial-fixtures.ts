/** @file editorial-fixtures.ts @description 独立登记首发内容候选；仅给本次完整新建四项接线，保留已有编辑与删除归属。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { MediaStorage } from '../modules/media/media-storage'
import type { FixtureProgress } from './fixture-ledger'
import { ensureFixture, fixtureHash, fixtureRow } from './fixture-ledger'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { AdminPostService } from '../modules/post/admin-post.service'
import { PostRevisionsService } from '../modules/post/post-revisions.service'
import { ProjectService } from '../modules/project/project.service'
import { randomUUID } from 'node:crypto'
import {
  EDITORIAL_DATASET,
  EDITORIAL_CREATE_REASON,
  EDITORIAL_REFRESH_REASON,
  editorialArticles,
} from './editorial-content'
import {
  editorialCandidates,
  editorialLedgerKey,
  editorialPostInput,
  editorialProjectInput,
  editorialRelations,
} from './editorial-model'
import type { EditorialIds } from './editorial-model'
export { EDITORIAL_DATASET, editorialArticles } from './editorial-content'
export const EDITORIAL_FIXTURE_COUNT = 4

export async function seedEditorialFixtures(
  em: EntityManager,
  _storage: MediaStorage,
  progress: FixtureProgress,
  _createdMedia: string[],
) {
  const posts = new AdminPostService(em, new PostRevisionsService(em))
  const ids = {} as EditorialIds
  const created = new Set<string>()
  for (const article of editorialArticles) {
    const before = progress.created.length
    const id = await ensureFixture(
      em,
      EDITORIAL_DATASET,
      article.key,
      'post',
      async () => (await posts.save(null, editorialPostInput(article.key), EDITORIAL_CREATE_REASON)).id,
      progress,
    )
    if (id) ids[article.key] = Number(id)
    if (progress.created.length > before) created.add(article.key)
  }
  const before = progress.created.length
  const projectId = await ensureFixture(
    em,
    EDITORIAL_DATASET,
    'tixxinblog',
    'project',
    async () => (await new ProjectService(em).save(null, { ...editorialProjectInput(), requestId: randomUUID() })).id,
    progress,
  )
  if (projectId) ids.tixxinblog = Number(projectId)
  if (progress.created.length > before) created.add('tixxinblog')
  // 旧归属从不在seed里改写；单独的精确迁正命令负责旧稿升级。
  if (created.size !== EDITORIAL_FIXTURE_COUNT) return
  for (const candidate of editorialCandidates) {
    if (candidate.kind === 'post') {
      const current = await posts.detail(ids[candidate.key])
      await posts.save(
        ids[candidate.key],
        { ...editorialPostInput(candidate.key, editorialRelations(ids, candidate.key)), revision: current.revision },
        EDITORIAL_REFRESH_REASON,
      )
    } else {
      const projects = new ProjectService(em)
      const current = await projects.detail(ids.tixxinblog, true)
      await projects.save(ids.tixxinblog, {
        ...editorialProjectInput(editorialRelations(ids, 'tixxinblog')),
        revision: current.revision,
      })
    }
    const ledger = await em.findOneOrFail(DevelopmentFixture, { key: editorialLedgerKey(candidate.key) })
    ledger.snapshotHash = fixtureHash((await fixtureRow(em, candidate.kind, String(ids[candidate.key])))!)
  }
  await em.flush()
}
