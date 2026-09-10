/** @file gallery-fixtures.ts @description 图库版本化自然样本；手工日期用于场景覆盖，地点和器材未知时留空，不模拟 EXIF */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MediaAsset } from '../entities/media-asset.entity'
import { GalleryService } from '../modules/gallery/gallery.service'
import { MediaService } from '../modules/media/media.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const GALLERY_DATASET = 'gallery-v1'
export const GALLERY_ASSETS = ['ridge', 'night', 'pizza', 'mist', 'skyline', 'breakfast', 'portrait', 'lake'] as const
const photos = [
  ['山脊的光', '风景', 'ridge', '群山层层退向天边，云隙间的光线让山脊显出不同的灰度。'],
  ['夜色渐浓', '城市', 'night', '窗里的灯光陆续亮起，城市在入夜之后展现出另一种秩序。'],
  ['刚出炉', '餐桌', 'pizza', '热气、芝士和烤得微焦的饼边。'],
  ['薄雾之间', '风景', 'mist', '山谷被雾缓缓填满，视线沿着草坡和树影向远处延伸。'],
  ['楼宇之间', '城市', 'skyline', '换一个高度看城市，密集的楼宇也有清晰的节奏。'],
  ['慢慢吃早餐', '餐桌', 'breakfast', '把早晨留给一顿不用赶时间的早餐。'],
  ['目光', '人像', 'portrait', '简单的背景，让目光成为画面的中心。'],
  ['湖与远山', '风景', 'lake', '风吹过湖面，远处的山像一层安静的背景。'],
  [
    '远方的层次',
    '风景',
    'ridge',
    '同一片山在不同的观看顺序中有不同的重心。先看明亮的山脊，再慢慢辨认阴影里的纹理；远处的线条逐渐变淡，近处的石壁却仍然清晰。停留久一点，眼睛会发现最初没有注意到的细节。画面没有唯一的中心，可以沿着自己的视线，从云层一路走到最远的山峰。',
  ],
  ['街区灯火', '城市', 'night', ''],
  ['分享一餐', '餐桌', 'pizza', '一张桌子，几块披萨，足够聊很久。'],
  ['风经过山谷', '风景', 'mist', '把喧闹留在山谷之外。'],
  ['窗格的节奏', '城市', 'skyline', '横向与纵向的线条，在密集的建筑之间交错。'],
  ['午前片刻', '餐桌', 'breakfast', ''],
  ['安静的侧面', '', 'portrait', '让构图简单一点。'],
  ['水面之外', '风景', 'lake', '留下水面与山之间的空白。'],
  ['尚未定稿的山色', '风景', 'ridge', '还想再想一想这张照片的排列位置。'],
  ['收起的夜景', '城市', 'night', '整理照片时暂时收起，之后再决定是否放回。'],
] as const
export const GALLERY_FIXTURE_COUNT = GALLERY_ASSETS.length + photos.length

export async function seedGalleryFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const media = new Map<string, string>()
  for (const name of GALLERY_ASSETS) {
    const id = await ensureFixture(
      em,
      GALLERY_DATASET,
      name,
      'media',
      async () => {
        // 保留素材使补种不依赖外站连通性；文件依然经过正常上传解码和尺寸提取。
        const buffer = await readFile(resolve(__dirname, '../../src/seeders/gallery-assets', `${name}.webp`))
        const id = randomUUID()
        createdMedia.push(id)
        return (
          await new MediaService(em, storage).upload(
            { buffer, originalname: `${name}.webp`, mimetype: 'image/webp', size: buffer.length },
            photos.find((photo) => photo[2] === name)![0],
            id,
          )
        ).id
      },
      progress,
    )
    if (!id) continue
    const asset = await em.findOne(MediaAsset, { id, deletedAt: null })
    if (!asset || !(await storage.readIfExists(asset.storageKey))) {
      progress.unavailable.push(`${GALLERY_DATASET}/media/${name}/file`)
      continue
    }
    media.set(name, id)
  }
  const service = new GalleryService(em)
  const now = new Date()
  for (const [index, [title, category, image, description]] of photos.entries()) {
    await ensureFixture(
      em,
      GALLERY_DATASET,
      String(index),
      'gallery',
      async () => {
        const mediaId = media.get(image)
        if (!mediaId) return null
        // 这是可编辑的手工拍摄日期，不从上传/创建时间推导或宣称为素材 EXIF。
        const takenOn =
          index % 5 === 4
            ? null
            : new Date(now.getTime() - (index < 4 ? index + 1 : 365 + index * 17) * 86400000).toISOString().slice(0, 10)
        return (
          await service.save(null, {
            requestId: randomUUID(),
            mediaId,
            title,
            description,
            category,
            takenOn,
            location: '',
            device: '',
            sortOrder: index === 7 ? 100 : index % 3,
            status: index === 16 ? 'draft' : index === 17 ? 'withdrawn' : 'published',
          })
        ).id
      },
      progress,
    )
  }
}
