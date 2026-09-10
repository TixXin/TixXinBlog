/** @file content-import-gallery.ts @description 在内容迁入事务中创建图库草稿并重建媒体引用，不复活删除作品或继承请求去重凭据 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { synchronizeMediaReferences } from '../media/media-references'

export async function importGallery(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.gallery ?? []) {
    const target = plan.gallery.find((photo) => photo.sourceId === source.sourceId)!
    if (target.skip) continue
    const { mediaId, ...values } = source.values
    const photo = em.create(GalleryPhoto, {
      ...values,
      status: 'draft',
      media: em.getReference(MediaAsset, mediaId),
      createdAt: new Date(source.createdAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    })
    await em.flush()
    await synchronizeMediaReferences(em, `gallery:${photo.id}`, 'gallery', [`/api/v1/media/${mediaId}.webp`], {
      galleryPhoto: photo,
    })
    result.gallery.push({ sourceId: source.sourceId, id: photo.id })
  }
}
