/** @file content-import-links.ts @description 友链迁入只建草稿，可显式复制相同URL，不改写地址或复活删除记录，并映射可选受管Logo */
import type { EntityManager } from '@mikro-orm/postgresql'
import { FriendLink } from '../../entities/friend-link.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importLinks(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.links ?? []) {
    const target = plan.links.find((link) => link.sourceId === source.sourceId)!
    if (target.skip) continue
    const { logoMediaId, ...values } = source.values
    const link = em.create(FriendLink, {
      ...values,
      status: 'draft',
      logoMedia: logoMediaId ? em.getReference(MediaAsset, logoMediaId) : null,
      createdAt: new Date(source.createdAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    })
    await em.flush()
    await synchronizeMediaReferences(
      em,
      `link:${link.id}`,
      'link',
      logoMediaId ? [`/api/v1/media/${logoMediaId}.webp`] : [],
      { friendLink: link },
    )
    result.links.push({ sourceId: source.sourceId, id: link.id })
  }
}
