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
// 每张作品记录具体的拍摄地，与画面内容对应；器材不补造，保持缺省。
const photos = [
  ['山脊的光', '风景', 'ridge', '群山层层退向天边，云隙间的光线让山脊显出不同的灰度。', '四川 · 贡嘎山'],
  ['夜色渐浓', '城市', 'night', '窗里的灯光陆续亮起，城市在入夜之后展现出另一种秩序。', '上海 · 陆家嘴'],
  ['刚出炉', '餐桌', 'pizza', '热气、芝士和烤得微焦的饼边。', '杭州 · 湖滨银泰'],
  ['薄雾之间', '风景', 'mist', '山谷被雾缓缓填满，视线沿着草坡和树影向远处延伸。', '云南 · 西双版纳'],
  ['楼宇之间', '城市', 'skyline', '换一个高度看城市，密集的楼宇也有清晰的节奏。', '深圳 · 莲花山'],
  ['慢慢吃早餐', '餐桌', 'breakfast', '把早晨留给一顿不用赶时间的早餐。', '家里'],
  ['目光', '人像', 'portrait', '简单的背景，让目光成为画面的中心。', '工作室'],
  ['湖与远山', '风景', 'lake', '风吹过湖面，远处的山像一层安静的背景。', '大理 · 洱海'],
  [
    '远方的层次',
    '风景',
    'ridge',
    '同一片山在不同的观看顺序中有不同的重心。先看明亮的山脊，再慢慢辨认阴影里的纹理；远处的线条逐渐变淡，近处的石壁却仍然清晰。停留久一点，眼睛会发现最初没有注意到的细节。画面没有唯一的中心，可以沿着自己的视线，从云层一路走到最远的山峰。',
    '四川 · 子梅垭口',
  ],
  ['街区灯火', '城市', 'night', '', '重庆 · 洪崖洞'],
  ['分享一餐', '餐桌', 'pizza', '一张桌子，几块披萨，足够聊很久。', '深圳 · 海岸城'],
  ['风经过山谷', '风景', 'mist', '把喧闹留在山谷之外。', '云南 · 普洱'],
  ['窗格的节奏', '城市', 'skyline', '横向与纵向的线条，在密集的建筑之间交错。', '广州 · 珠江新城'],
  ['午前片刻', '餐桌', 'breakfast', '', '成都 · 玉林路'],
  ['安静的侧面', '', 'portrait', '让构图简单一点。', '工作室'],
  ['水面之外', '风景', 'lake', '留下水面与山之间的空白。', '杭州 · 西湖'],
  ['尚未定稿的山色', '风景', 'ridge', '还想再想一想这张照片的排列位置。', '四川 · 贡嘎山'],
  ['收起的夜景', '城市', 'night', '整理照片时暂时收起，之后再决定是否放回。', '上海 · 外滩'],
] as const
const detailedPhotos = [
  ['湖边的清晨', '风景', 'lake', '趁着风还没起来，把湖面和远山一起收进画面。', '山间湖畔步道', '数码单反'],
  ['楼顶的傍晚', '城市', 'skyline', '太阳落到楼群后面，天色还留着一层暖调。', '深圳 · 福田', '微单相机'],
] as const
export const GALLERY_FIXTURE_COUNT = GALLERY_ASSETS.length + photos.length + detailedPhotos.length

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
  for (const [index, [title, category, image, description, location]] of photos.entries()) {
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
            location,
            device: '',
            sortOrder: index === 7 ? 100 : index % 3,
            status: index === 16 ? 'draft' : index === 17 ? 'withdrawn' : 'published',
          })
        ).id
      },
      progress,
    )
  }
  // 地点与器材同样是可编辑的手工字段，与拍摄日期一致：描述画面可见的环境与器材类别，不宣称原素材的精确来源。
  for (const [slot, [title, category, image, description, location, device]] of detailedPhotos.entries())
    await ensureFixture(
      em,
      GALLERY_DATASET,
      `detailed-${slot}`,
      'gallery',
      async () => {
        const mediaId = media.get(image)
        if (!mediaId) return null
        return (
          await service.save(null, {
            requestId: randomUUID(),
            mediaId,
            title,
            description,
            category,
            takenOn: new Date(now.getTime() - (slot + 2) * 86400000).toISOString().slice(0, 10),
            location,
            device,
            sortOrder: 0,
            status: 'published',
          })
        ).id
      },
      progress,
    )
}
