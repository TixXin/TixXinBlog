/** @file development-datasets.ts @description 版本化样本集统一登记，范围与预期归属数量从各域真实定义汇总 */
import { seedCoreFixtures, CORE_DATASET, CORE_FIXTURE_COUNT } from './core-fixtures'
import { seedGuestbookFixtures, GUESTBOOK_DATASET, GUESTBOOK_FIXTURE_COUNT } from './guestbook-fixtures'
import { seedGalleryFixtures, GALLERY_DATASET, GALLERY_FIXTURE_COUNT } from './gallery-fixtures'
import { seedProjectFixtures, PROJECT_DATASET, PROJECT_FIXTURE_COUNT } from './project-fixtures'
import { seedLinkFixtures, LINK_DATASET, LINK_FIXTURE_COUNT } from './link-fixtures'
import {
  seedGalleryExternalFixtures,
  GALLERY_EXTERNAL_DATASET,
  GALLERY_EXTERNAL_PHOTOS,
} from './gallery-external-fixtures'

export const DEFAULT_DEVELOPMENT_DATASET = CORE_DATASET
export const DEVELOPMENT_DATASETS = [
  { id: CORE_DATASET, count: CORE_FIXTURE_COUNT, scope: '核心文章、闪念、朋友圈及互动', seed: seedCoreFixtures },
  {
    id: GUESTBOOK_DATASET,
    count: GUESTBOOK_FIXTURE_COUNT,
    scope: '留言、审核、头像与回应',
    seed: seedGuestbookFixtures,
  },
  {
    id: GALLERY_DATASET,
    count: GALLERY_FIXTURE_COUNT,
    scope: '图库作品、分页、状态与横竖照片',
    seed: seedGalleryFixtures,
  },
  {
    id: PROJECT_DATASET,
    count: PROJECT_FIXTURE_COUNT,
    scope: '项目、独立进展、标签、封面与有效链接',
    seed: seedProjectFixtures,
  },
  { id: LINK_DATASET, count: LINK_FIXTURE_COUNT, scope: '友链、发布推荐、排序与可选标志', seed: seedLinkFixtures },
  {
    id: GALLERY_EXTERNAL_DATASET,
    count: GALLERY_EXTERNAL_PHOTOS.length,
    scope: '图库外链、查询参数、横竖比例与发布状态',
    seed: seedGalleryExternalFixtures,
  },
] as const
export const DEVELOPMENT_DATASET_NAMES: string[] = DEVELOPMENT_DATASETS.map((dataset) => dataset.id)
