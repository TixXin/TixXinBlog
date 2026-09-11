/** @file gallery-external-fixtures.ts @description 图库外链增量场景，稳定归属且不抓取图片，不覆盖既有作品或已删除归属 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { GalleryService } from '../modules/gallery/gallery.service'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'
import type { MediaStorage } from '../modules/media/media-storage'

export const GALLERY_EXTERNAL_DATASET = 'gallery-external-v1'
// 沿用图库现有 Unsplash 素材来源。尺寸由浏览器读取，不写入虚构元信息。
export const GALLERY_EXTERNAL_PHOTOS = [
  {
    title: '山色与云的边界',
    category: '风景',
    externalUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=max&w=1200&q=80',
    status: 'published',
  },
  {
    title: '一束安静的目光',
    category: '人像',
    externalUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=max&w=800&q=80',
    status: 'published',
  },
  {
    title: '留待整理的湖光',
    category: '',
    externalUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=max&w=1000&q=80',
    status: 'draft',
  },
  {
    title: '暂别的城市夜色',
    category: '城市',
    externalUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=max&w=1000&q=80',
    status: 'withdrawn',
  },
] as const
export async function seedGalleryExternalFixtures(
  em: EntityManager,
  _storage: MediaStorage,
  progress: FixtureProgress,
) {
  const service = new GalleryService(em)
  for (const [index, photo] of GALLERY_EXTERNAL_PHOTOS.entries()) {
    await ensureFixture(
      em,
      GALLERY_EXTERNAL_DATASET,
      String(index),
      'gallery',
      async () =>
        (await service.save(null, { ...photo, mediaId: null, requestId: randomUUID(), sortOrder: 30 - index })).id,
      progress,
    )
  }
}
