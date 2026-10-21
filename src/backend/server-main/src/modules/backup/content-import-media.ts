/**
 * @file content-import-media.ts
 * @description 迁入事务中的受管媒体资产写入与分类标签创建。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../entities/media-asset.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { MediaStorage } from '../media/media-storage'
import { canonicalTaxonomyLabel } from '../post/taxonomy-aliases'

export async function importMediaAssets(
  em: EntityManager,
  storage: MediaStorage,
  current: ContentImportPlan,
  payload: ContentPackage,
  written: string[],
  result: ContentImportResult,
): Promise<void> {
  for (const plan of current.media) {
    if (plan.skip) continue
    const source = payload.media.find((asset) => asset.id === plan.id)
    if (!source) continue
    if (plan.writeFile && source.base64) {
      await storage.put(`${source.id}.webp`, Buffer.from(source.base64, 'base64'))
      written.push(`${source.id}.webp`)
      result.files += 1
    }
    if (plan.create) {
      em.create(MediaAsset, {
        id: source.id,
        originalName: source.name,
        storageKey: `${source.id}.webp`,
        mimeType: 'image/webp',
        byteSize: source.byteSize,
        width: source.width,
        height: source.height,
        sha256: source.sha256,
        alt: source.alt,
        description: source.description ?? '',
        createdAt: new Date(source.createdAt),
        deletedAt: source.deleted ? new Date() : undefined,
      })
      result.media += 1
    }
  }
  await em.flush()
}

export async function importTaxonomies(em: EntityManager, payload: ContentPackage): Promise<void> {
  for (const folder of payload.folders) {
    const label = await canonicalTaxonomyLabel(em, 'folders', folder)
    if (!(await em.findOne(PostFolder, { label }))) em.create(PostFolder, { label })
  }
  for (const tag of payload.tags) {
    const label = await canonicalTaxonomyLabel(em, 'tags', tag.label)
    if (!(await em.findOne(PostTag, { label }))) em.create(PostTag, { label, slug: label, color: tag.color, count: 0 })
  }
  await em.flush()
}
