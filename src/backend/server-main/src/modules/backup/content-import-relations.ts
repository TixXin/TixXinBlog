/** @file content-import-relations.ts @description 新内容全部取得编号后映射有向关系，保留跳过目标且不触碰媒体引用 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { Project } from '../../entities/project.entity'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { mappedRelations, relationSources } from './content-relation-plan'

export async function importContentRelations(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  const created = { post: result.posts, project: result.projects, gallery: result.gallery }
  let applied = 0
  for (const type of ['post', 'project', 'gallery'] as const) {
    for (const target of created[type]) {
      const source = relationSources(payload, type).find((item) => item.sourceId === target.sourceId)!
      const related = mappedRelations(
        type,
        source.sourceId,
        source.values.relatedContent ?? [],
        plan.relationMapping ?? {},
        created,
      )
      applied += related.length
      if (type === 'post') {
        const post = await em.findOneOrFail(Post, { id: target.id })
        post.relatedContent = related
        const revision = await em.findOneOrFail(PostRevision, { post, revision: post.revision })
        revision.snapshot = { ...revision.snapshot, relatedContent: related }
      } else if (type === 'project') {
        const project = await em.findOneOrFail(Project, { id: target.id })
        project.relatedContent = related
      } else {
        const gallery = await em.findOneOrFail(GalleryPhoto, { id: target.id })
        gallery.relatedContent = related
      }
    }
  }
  result.relations = { applied, omitted: plan.omittedRelations ?? 0 }
  await em.flush()
}
