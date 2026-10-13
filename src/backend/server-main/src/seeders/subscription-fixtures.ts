/** @file subscription-fixtures.ts @description 订阅开发代表值与稳定归属；金额不代表博主实际消费或商家实时报价 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { addMonths, todayDate } from '@tixxin/subscription-domain'
import type { BillingCycle, Currency, SubscriptionCategory, SubscriptionStatus } from '@tixxin/subscription-domain'
import { SubscriptionService } from '../modules/subscription/subscription.service'
import { MediaService } from '../modules/media/media.service'
import { MediaAsset } from '../entities/media-asset.entity'
import type { MediaStorage } from '../modules/media/media-storage'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const SUBSCRIPTION_DATASET = 'subscription-v1'
export const SUBSCRIPTION_RECORD_COUNT = 15
export const SUBSCRIPTION_FIXTURE_COUNT = SUBSCRIPTION_RECORD_COUNT + 1
const definitions: [string, Currency, number, BillingCycle, SubscriptionCategory, SubscriptionStatus, string | null][] =
  [
    ['ChatGPT Plus', 'USD', 2000, 'monthly', 'ai', 'active', 'https://chatgpt.com/'],
    ['JetBrains 开发工具', 'USD', 28900, 'yearly', 'development', 'active', 'https://www.jetbrains.com/'],
    ['云端相册', 'CNY', 6800, 'monthly', 'cloud', 'active', null],
    ['季度写作空间', 'CNY', 10000, 'quarterly', 'productivity', 'active', null],
    ['日语阅读室', 'JPY', 1000, 'monthly', 'education', 'active', null],
    ['iCloud 储存空间', 'HKD', 2300, 'monthly', 'cloud', 'active', 'https://www.apple.com/icloud/'],
    ['Vue 开源支持', 'EUR', 1200, 'quarterly', 'design', 'active', 'https://vuejs.org/'],
    ['旅行通信套餐', 'GBP', 500, 'monthly', 'communication', 'paused', null],
    ['音乐收藏', 'TWD', 14900, 'monthly', 'entertainment', 'cancelled', null],
    ['灵感助手', 'USD', 0, 'monthly', 'ai', 'trial', null],
    ['旧域名', 'CNY', 8800, 'yearly', 'cloud', 'expired', null],
    ['离线词典', 'CNY', 29900, 'lifetime', 'education', 'active', null],
    ['Vue 生态支持', 'CNY', 35000, 'one-time', 'design', 'active', 'https://vuejs.org/'],
    ['准备启用的跨设备阅读与资料归档空间', 'CNY', 2900, 'monthly', 'other', 'active', null],
    ['摄影课程', 'JPY', 2000, 'yearly', 'education', 'active', null],
  ]
function daysFrom(date: string, offset: number) {
  const value = new Date(date + 'T00:00:00.000Z')
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}
export async function seedSubscriptionFixtures(
  em: EntityManager,
  storage: MediaStorage,
  progress: FixtureProgress,
  createdMedia: string[],
) {
  const mediaId = await ensureFixture(
    em,
    SUBSCRIPTION_DATASET,
    'vue',
    'media',
    async () => {
      // 复用仓库中已有来源及许可说明的 Vue 标志，不请求第三方网络。
      const buffer = await readFile(resolve(__dirname, 'link-assets/vue.webp'))
      const id = randomUUID()
      createdMedia.push(id)
      return (
        await new MediaService(em, storage).upload(
          { buffer, size: buffer.length, originalname: 'subscription-vue.webp', mimetype: 'image/webp' },
          'Vue 标志',
          id,
        )
      ).id
    },
    progress,
  )
  const media = mediaId ? await em.findOne(MediaAsset, { id: mediaId, deletedAt: null }) : null
  const available = media && (await storage.readIfExists(media.storageKey))
  if (mediaId && !available) progress.unavailable.push(`${SUBSCRIPTION_DATASET}/media/vue/file`)
  const today = todayDate(),
    service = new SubscriptionService(em)
  for (const [
    index,
    [name, currency, amount, billingCycle, category, subscriptionStatus, url],
  ] of definitions.entries()) {
    await ensureFixture(
      em,
      SUBSCRIPTION_DATASET,
      String(index),
      'subscription',
      async () => {
        if (index === 6 && !available) return null
        const dated = index < 9 || index === 13
        const nextBillingDate = dated ? daysFrom(today, index === 2 ? -4 : index === 13 ? 40 : index + 3) : null
        const startDate = index === 13 ? daysFrom(today, 40) : dated ? addMonths(nextBillingDate!, -12) : null
        let saved = await service.save(null, {
          requestId: randomUUID(),
          name,
          currency: index === 4 ? 'USD' : currency,
          amount: index === 0 ? 1800 : index === 4 ? 900 : amount,
          billingCycle: index === 3 ? 'monthly' : billingCycle,
          category,
          subscriptionStatus,
          url,
          platform: index === 0 ? 'OpenAI' : index === 1 ? 'JetBrains' : null,
          description:
            index === 0
              ? '用于整理长文结构、查阅资料与梳理开发思路。保留每次调整的价格，定期回看工具使用频率与预算安排。'
              : index === 6
                ? '为经常使用的开源工具留一份持续支持。'
                : '',
          notes: '',
          startDate,
          nextBillingDate,
          iconMediaId: index === 6 ? mediaId : null,
          status: index === 13 ? 'draft' : index === 14 ? 'withdrawn' : 'published',
          sortOrder: 100 - index,
        })
        if (index === 0) {
          saved = await service.save(saved.id, {
            revision: saved.revision,
            amount: 1900,
            priceChangeReason: '调整月度方案',
          })
          saved = await service.save(saved.id, { revision: saved.revision, amount, priceChangeReason: '更新服务方案' })
        }
        if (index === 3)
          saved = await service.save(saved.id, {
            revision: saved.revision,
            billingCycle,
            priceChangeReason: '改为季度安排',
          })
        if (index === 4)
          saved = await service.save(saved.id, {
            revision: saved.revision,
            currency,
            amount,
            priceChangeReason: '切换结算币种',
          })
        return saved.id
      },
      progress,
    )
  }
}
