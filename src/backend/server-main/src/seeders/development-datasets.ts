/** @file development-datasets.ts @description 版本化样本集统一登记，范围与预期归属数量从各域真实定义汇总 */
import { seedCoreFixtures, CORE_DATASET, CORE_FIXTURE_COUNT } from './core-fixtures'
import { seedShowcaseFixtures, SHOWCASE_DATASET, SHOWCASE_FIXTURE_COUNT } from './showcase-fixtures'
import { seedEditorialFixtures, EDITORIAL_DATASET, EDITORIAL_FIXTURE_COUNT } from './editorial-fixtures'
import { seedNotificationFixtures, NOTIFICATION_DATASET, NOTIFICATION_FIXTURE_COUNT } from './notification-fixtures'
import { seedWritingFixtures, WRITING_DATASET, WRITING_FIXTURE_COUNT } from './writing-fixtures'
import { seedGuestbookFixtures, GUESTBOOK_DATASET, GUESTBOOK_FIXTURE_COUNT } from './guestbook-fixtures'
import { seedGalleryFixtures, GALLERY_DATASET, GALLERY_FIXTURE_COUNT } from './gallery-fixtures'
import { seedProjectFixtures, PROJECT_DATASET, PROJECT_FIXTURE_COUNT } from './project-fixtures'
import { seedSubscriptionFixtures, SUBSCRIPTION_DATASET, SUBSCRIPTION_FIXTURE_COUNT } from './subscription-fixtures'
import { seedLinkFixtures, LINK_DATASET, LINK_FIXTURE_COUNT } from './link-fixtures'
import { seedPromptFixtures, PROMPT_DATASET, PROMPT_FIXTURE_COUNT } from './prompt-fixtures'
import {
  seedGalleryExternalFixtures,
  GALLERY_EXTERNAL_DATASET,
  GALLERY_EXTERNAL_PHOTOS,
} from './gallery-external-fixtures'

export const DEFAULT_DEVELOPMENT_DATASET = CORE_DATASET
export const DEVELOPMENT_DATASETS = [
  {
    id: SHOWCASE_DATASET,
    count: SHOWCASE_FIXTURE_COUNT,
    scope: '真实感样本：五十篇长文与评论点赞、十八条朋友圈、图库作品、当天留言及博主资料（资料仅在未编辑时写入）',
    seed: seedShowcaseFixtures,
  },
  {
    id: SUBSCRIPTION_DATASET,
    count: SUBSCRIPTION_FIXTURE_COUNT,
    scope: '平台订阅费、多币种周期和双状态、价格历史、近期日期与受管图标；金额为开发代表值',
    seed: seedSubscriptionFixtures,
  },
  {
    id: PROMPT_DATASET,
    count: PROMPT_FIXTURE_COUNT,
    scope: '图片提示词、原创图与可追溯视觉参考、分页、公开草稿及横竖构图',
    seed: seedPromptFixtures,
  },
  {
    id: WRITING_DATASET,
    count: WRITING_FIXTURE_COUNT,
    scope: '长文、媒体说明和有向关联阅读',
    seed: seedWritingFixtures,
  },
  {
    id: NOTIFICATION_DATASET,
    count: NOTIFICATION_FIXTURE_COUNT,
    scope: '近期互动、通知分页与已读/处理分离，邮件任务保持暂停',
    seed: seedNotificationFixtures,
  },
  {
    id: EDITORIAL_DATASET,
    count: EDITORIAL_FIXTURE_COUNT,
    scope: '基于仓库事实的技术文章及项目候选，全部保持草稿',
    seed: seedEditorialFixtures,
  },
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
