/**
 * @file subscription-settings.entity.ts
 * @description 平台订阅费的运行配置（单行 id='default'）：博主手填的参考汇率与私密续费日历令牌的哈希。
 *   属于运行配置：完整备份包含，内容包不导出；令牌原文只在生成时返回一次，库内仅存 SHA-256。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import type { Currency } from '@tixxin/subscription-domain'

@Entity({ tableName: 'subscription_settings' })
export class SubscriptionSettings {
  @PrimaryKey({ type: 'text' }) id!: string
  /** 折合估算的基准币种；为空表示未启用参考汇率 */
  @Property({ type: 'text', nullable: true }) baseCurrency: Currency | null = null
  /** “1 单位该币种折合多少基准币种”的十进制字符串 */
  @Property({ type: 'json', defaultRaw: "'{}'::jsonb" }) rates: Partial<Record<Currency, string>> = {}
  /** 汇率由博主核对的日期 YYYY-MM-DD，公开展示用于提示时效 */
  @Property({ type: 'date', nullable: true }) ratesUpdatedAt: string | null = null
  /** 续费日历令牌的 SHA-256（十六进制）；为空表示未开启 */
  @Property({ type: 'text', nullable: true }) calendarTokenHash: string | null = null
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
