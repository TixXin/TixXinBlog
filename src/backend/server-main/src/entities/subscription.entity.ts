/** @file subscription.entity.ts @description 平台订阅费用与不可覆写的价格快照，管理备注不属于公开内容 */
import { Check, Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import type {
  BillingCycle,
  Currency,
  PausedPeriod,
  PriceHistoryEntry,
  PublicationStatus,
  SubscriptionCategory,
  SubscriptionStatus,
} from '@tixxin/subscription-domain'
import { MediaAsset } from './media-asset.entity'

@Entity({ tableName: 'subscription' })
@Index({ name: 'subscription_visibility_order_idx', properties: ['status', 'deletedAt', 'sortOrder', 'id'] })
@Index({ name: 'subscription_filters_idx', properties: ['status', 'currency', 'category', 'subscriptionStatus'] })
@Unique({ properties: ['requestId'] })
@Check({ name: 'subscription_amount_check', expression: 'amount >= 0' })
export class Subscription {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'category'
    | 'subscriptionStatus'
    | 'notes'
    | 'priceHistory'
    | 'pausedPeriods'
    | 'status'
    | 'sortOrder'
    | 'revision'
    | 'createdAt'
    | 'updatedAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) name!: string
  @Property({ type: 'text', default: '' }) description = ''
  @Property({ type: 'text', nullable: true }) url?: string | null
  @Property({ type: 'text', nullable: true }) platform?: string | null
  @Property({ type: 'text', default: 'other' }) category: SubscriptionCategory = 'other'
  @Property({ type: 'text' }) currency!: Currency
  @Property({ type: 'integer' }) amount!: number
  @Property({ type: 'text' }) billingCycle!: BillingCycle
  @Property({ type: 'date', nullable: true }) startDate?: string | null
  @Property({ type: 'date', nullable: true }) nextBillingDate?: string | null
  /** 试用到期（首次扣费）日 */
  @Property({ type: 'date', nullable: true }) trialEndDate?: string | null
  /** 服务结束日：当天及之后不再扣费 */
  @Property({ type: 'date', nullable: true }) endDate?: string | null
  /** 暂停区间：[from, to) 内不扣费，to 为 null 表示仍在暂停 */
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) pausedPeriods: PausedPeriod[] = []
  /** 套餐名（如“家庭版”“Plus”），公开展示 */
  @Property({ type: 'text', nullable: true }) planName?: string | null
  /** 付款方式（如“招行信用卡”），只在后台可见，不进入公开接口 */
  @Property({ type: 'text', nullable: true }) paymentMethod?: string | null
  @Property({ type: 'text', default: 'active' }) subscriptionStatus: SubscriptionStatus = 'active'
  @Property({ type: 'text', default: '' }) notes = ''
  @ManyToOne({ entity: () => MediaAsset, nullable: true, deleteRule: 'restrict' }) iconMedia?: MediaAsset | null
  @Property({ type: 'text', nullable: true }) faviconDomain?: string | null
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) priceHistory: PriceHistoryEntry[] = []
  @Property({ type: 'text', default: 'draft' }) status: PublicationStatus = 'draft'
  @Property({ type: 'integer', default: 0 }) sortOrder = 0
  @Property({ type: 'integer', default: 0 }) revision = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt = new Date()
}
