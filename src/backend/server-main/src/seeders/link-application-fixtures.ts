/** @file link-application-fixtures.ts @description 友链申请审核的代表样本：待审、已通过（含生成的友链草稿）与已拒绝各一条；不改动申请开关，不写通知 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { FriendLink } from '../entities/friend-link.entity'
import { FriendLinkApplication } from '../entities/friend-link-application.entity'
import { LinkApplicationService } from '../modules/link/link-application.service'
import { LinkService } from '../modules/link/link.service'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const LINK_APPLICATION_DATASET = 'link-application-v1'
const DAY = 24 * 60 * 60 * 1000
const applications = [
  {
    scenario: 'pending',
    name: 'Astro',
    url: 'https://astro.build/',
    description: '以内容为中心的网站框架，文档里有不少关于静态生成与部分水合的讨论。',
    contact: null,
    message: '最近在比较几种静态站点方案，读到贵站的部署记录很有启发，希望能交换友链。',
    daysAgo: 1,
  },
  {
    scenario: 'approved',
    name: 'Svelte',
    url: 'https://svelte.dev/',
    description: '编译期处理响应式的前端框架，教程可以直接在浏览器里练习。',
    contact: 'GitHub @sveltejs',
    message: '',
    daysAgo: 6,
  },
  {
    scenario: 'rejected',
    name: 'Deno',
    url: 'https://deno.com/',
    description: 'JavaScript 与 TypeScript 运行时及其部署平台。',
    contact: null,
    message: '你好，路过留个申请。',
    daysAgo: 12,
  },
] as const
/** 三条申请外加通过时生成的一条友链草稿 */
export const LINK_APPLICATION_FIXTURE_COUNT = applications.length + 1

export async function seedLinkApplicationFixtures(
  em: EntityManager,
  _storage: MediaStorage,
  progress: FixtureProgress,
) {
  const links = new LinkService(em),
    service = new LinkApplicationService(em, links)
  let approvedId: string | null = null
  for (const item of applications) {
    const id = await ensureFixture(
      em,
      LINK_APPLICATION_DATASET,
      item.scenario,
      'link-application',
      async () => {
        // 同址已有友链或待审申请时不接管用户数据，只记录不可用。
        if (
          (await em.findOne(FriendLink, { url: item.url, deletedAt: null })) ||
          (await em.findOne(FriendLinkApplication, { url: item.url, status: 'pending' }))
        ) {
          progress.unavailable.push(`${LINK_APPLICATION_DATASET}/link-application/${item.scenario}/url-already-present`)
          return null
        }
        const createdAt = new Date(Date.now() - item.daysAgo * DAY)
        const application = em.create(FriendLinkApplication, {
          id: randomUUID(),
          name: item.name,
          url: item.url,
          description: item.description,
          contact: item.contact,
          message: item.message,
          createdAt,
          updatedAt: createdAt,
        })
        await em.flush()
        if (item.scenario === 'approved') await service.approve(application.id)
        if (item.scenario === 'rejected') await service.reject(application.id)
        return application.id
      },
      progress,
    )
    if (item.scenario === 'approved') approvedId = id
  }
  // 通过时生成的草稿单独登记归属，清理样本时与申请一起移除，用户编辑后则保留。
  await ensureFixture(
    em,
    LINK_APPLICATION_DATASET,
    'approved-draft',
    'link',
    async () => {
      if (!approvedId) return null
      const application = await em.findOne(FriendLinkApplication, { id: approvedId }, { refresh: true })
      return application?.createdLinkId ?? null
    },
    progress,
  )
}
