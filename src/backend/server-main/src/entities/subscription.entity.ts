/** @file subscription.entity.ts @description 平台订阅费用与不可覆写的价格快照，管理备注不属于公开内容 */
import { Check, Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import type {
  BillingCycle,
  Currency,
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
