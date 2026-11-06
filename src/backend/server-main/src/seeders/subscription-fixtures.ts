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
export const SUBSCRIPTION_RECORD_COUNT = 20
export const SUBSCRIPTION_FIXTURE_COUNT = SUBSCRIPTION_RECORD_COUNT + 1
const definitions: [string, Currency, number, BillingCycle, SubscriptionCategory, SubscriptionStatus, string | null][] =
  [
    ['ChatGPT Plus', 'USD', 2000, 'monthly', 'ai', 'active', 'https://chatgpt.com/'],
    ['JetBrains All Products Pack', 'USD', 28900, 'yearly', 'development', 'active', 'https://www.jetbrains.com/'],
    ['阿里云盘 超级会员', 'CNY', 6800, 'monthly', 'cloud', 'active', 'https://www.alipan.com/'],
    ['印象笔记 专业版', 'CNY', 10000, 'quarterly', 'productivity', 'active', 'https://www.yinxiang.com/'],
    ['Kindle Unlimited（日本）', 'JPY', 1000, 'monthly', 'education', 'active', 'https://www.amazon.co.jp/'],
    ['iCloud+ 储存空间', 'HKD', 2300, 'monthly', 'cloud', 'active', 'https://www.apple.com/icloud/'],
    ['Vue 开源支持', 'EUR', 1200, 'quarterly', 'design', 'active', 'https://vuejs.org/'],
    ['Three UK 数据套餐', 'GBP', 500, 'monthly', 'communication', 'paused', 'https://www.three.co.uk/'],
    ['KKBOX', 'TWD', 14900, 'monthly', 'entertainment', 'cancelled', 'https://www.kkbox.com/'],
    ['Claude Pro', 'USD', 0, 'monthly', 'ai', 'trial', 'https://claude.ai/'],
    ['阿里云 域名续费', 'CNY', 8800, 'yearly', 'cloud', 'expired', 'https://wanwang.aliyun.com/'],
    ['欧路词典 增强版', 'CNY', 29900, 'lifetime', 'education', 'active', 'https://www.eudic.net/'],
    ['Vue 生态赞助', 'CNY', 35000, 'one-time', 'design', 'active', 'https://vuejs.org/'],
    ['微信读书 无限卡', 'CNY', 2900, 'monthly', 'other', 'active', 'https://weread.qq.com/'],
    ['スタディサプリ ENGLISH', 'JPY', 2000, 'yearly', 'education', 'active', 'https://eigosapuri.jp/'],
    // 以下为多年/半年周期、带到期日的试用与有结束日的取消记录，追加在末尾以便已有开发库增量补齐
    ['Cloudflare 域名注册', 'USD', 2088, 'biennial', 'development', 'active', 'https://www.cloudflare.com/'],
    ['腾讯云 轻量应用服务器', 'CNY', 29700, 'semiannual', 'cloud', 'active', 'https://cloud.tencent.com/'],
    ['Raycast Pro', 'USD', 800, 'monthly', 'productivity', 'trial', 'https://www.raycast.com/'],
    ['Netflix 標準方案', 'HKD', 9300, 'monthly', 'entertainment', 'cancelled', 'https://www.netflix.com/'],
    ['Hetzner 存储盒', 'EUR', 13900, 'triennial', 'cloud', 'active', 'https://www.hetzner.com/'],
  ]
/** 序号 15 起的样本日期：多年周期、试用到期与结束日；早期样本沿用原有日期规则 */
function laterSchedule(index: number, today: string) {
  if (index === 15) return { startDate: addMonths(daysFrom(today, 25), -24), nextBillingDate: daysFrom(today, 25) }
  if (index === 16) return { startDate: addMonths(daysFrom(today, 60), -12), nextBillingDate: daysFrom(today, 60) }
  if (index === 17) return { startDate: daysFrom(today, -4), trialEndDate: daysFrom(today, 10) }
  if (index === 18) return { startDate: addMonths(today, -14), endDate: addMonths(today, -2) }
  return { startDate: addMonths(daysFrom(today, 200), -36), nextBillingDate: daysFrom(today, 200) }
}
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
        const early = {
          nextBillingDate: dated ? daysFrom(today, index === 2 ? -4 : index === 13 ? 40 : index + 3) : null,
        }
        const schedule =
          index >= 15
            ? laterSchedule(index, today)
            : {
                ...early,
                startDate: index === 13 ? daysFrom(today, 40) : dated ? addMonths(early.nextBillingDate!, -12) : null,
              }
        let saved = await service.save(null, {
          requestId: randomUUID(),
          name,
          currency: index === 4 ? 'USD' : currency,
          amount: index === 0 ? 1800 : index === 4 ? 900 : amount,
          billingCycle: index === 3 ? 'monthly' : billingCycle,
          category,
          subscriptionStatus,
          url,
          platform:
            index === 0
              ? 'OpenAI'
              : index === 1
                ? 'JetBrains'
                : index === 9
                  ? 'Anthropic'
                  : index === 2 || index === 10
                    ? '阿里云'
                    : null,
          description:
            index === 0
              ? '主要用来整理长文结构和查资料。价格调过两次，记录保留着，方便年底回看这笔开销值不值。'
              : index === 6
                ? '通过 Open Collective 给日常在用的开源项目留一份持续支持。'
                : index === 9
                  ? '试用期内，到期前决定要不要转正式订阅。'
                  : index === 13
                    ? '还在犹豫要不要长期续，先记一笔，下个月再看使用频率。'
                    : index === 17
                      ? '试用两周，到期后按月付转正，先看看剪贴板历史和窗口管理顺不顺手。'
                      : index === 18
                        ? '追完想看的剧就退了，到期后不再续费。'
                        : '',
          notes: '',
          startDate: schedule.startDate,
          nextBillingDate: schedule.nextBillingDate ?? null,
          trialEndDate: 'trialEndDate' in schedule ? schedule.trialEndDate : null,
          endDate: 'endDate' in schedule ? schedule.endDate : null,
          planName: index === 0 ? 'Plus' : index === 15 ? '域名注册（两年）' : null,
          // 暂停中的样本记一段尚未结束的暂停；暂停开始不早于订阅开始
          pausedPeriods: index === 7 ? [{ from: daysFrom(today, -20), to: null }] : [],
          iconMediaId: index === 6 ? mediaId : null,
          status: index === 13 ? 'draft' : index === 14 ? 'withdrawn' : 'published',
          sortOrder: 100 - index,
        })
        if (index === 0) {
          saved = await service.save(saved.id, {
            revision: saved.revision,
            amount: 1900,
            priceChangeReason: '官方调整月度方案价格',
          })
          saved = await service.save(saved.id, { revision: saved.revision, amount, priceChangeReason: '更新服务方案' })
        }
        if (index === 3)
          saved = await service.save(saved.id, {
            revision: saved.revision,
            billingCycle,
            priceChangeReason: '从月付改为季付',
          })
        if (index === 4)
          saved = await service.save(saved.id, {
            revision: saved.revision,
            currency,
            amount,
            priceChangeReason: '从美区账号转到日区结算',
          })
        return saved.id
      },
      progress,
    )
  }
}
