/** @file content-import-projects.ts @description 项目迁入保留业务进展、标签及链接，仅创建非公开草稿并映射可选封面，不复活删除项 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Project } from '../../entities/project.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importProjects(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.projects ?? []) {
    const target = plan.projects.find((project) => project.sourceId === source.sourceId)!
    if (target.skip) continue
    const { coverMediaId, ...values } = source.values
    const project = em.create(Project, {
      ...values,
      relatedContent: [],
      status: 'draft',
      coverMedia: coverMediaId ? em.getReference(MediaAsset, coverMediaId) : null,
      createdAt: new Date(source.createdAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    })
    await em.flush()
    await synchronizeMediaReferences(
      em,
      `project:${project.id}`,
      'project',
      coverMediaId ? [`/api/v1/media/${coverMediaId}.webp`] : [],
      { project },
    )
    result.projects.push({ sourceId: source.sourceId, id: project.id })
  }
}
