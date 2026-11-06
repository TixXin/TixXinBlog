/** @file subscription-settings.service.ts @description 订阅参考汇率与私密续费日历：单行运行配置、乐观版本、令牌只存哈希 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { isDate, todayDate, validateRates } from '@tixxin/subscription-domain'
import { msg } from '../../common/i18n'
import { SubscriptionSettings } from '../../entities/subscription-settings.entity'
import { Subscription } from '../../entities/subscription.entity'
import { readSiteTimeZone } from '../site/site-time-zone'
import { buildCalendar } from './subscription-calendar'
import type { SaveSubscriptionSettingsDto } from './subscription.dto'

const ID = 'default'
/** 日历 PRODID 与事件 UID 的域名：取站点地址（NOTIFICATION_SITE_URL），未配置或无效时用固定名 */
export function calendarHost(siteUrl = process.env.NOTIFICATION_SITE_URL): string {
  try {
    const host = siteUrl ? new URL(siteUrl).hostname : ''
    return /^[a-z0-9.-]+$/i.test(host) ? host.toLowerCase() : 'tixxin-blog'
  } catch {
    return 'tixxin-blog'
  }
}
const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

@Injectable()
export class SubscriptionSettingsService {
  constructor(private readonly em: EntityManager) {}
  private publicView(row: SubscriptionSettings | null) {
    return {
      baseCurrency: row?.baseCurrency ?? null,
      rates: row?.baseCurrency ? (row.rates ?? {}) : {},
      ratesUpdatedAt: row?.baseCurrency ? (row.ratesUpdatedAt ?? null) : null,
    }
  }
  private adminView(row: SubscriptionSettings | null) {
    return { ...this.publicView(row), revision: row?.revision ?? 0, calendarEnabled: !!row?.calendarTokenHash }
  }
  /** 公开读取：只含参考汇率，不暴露令牌状态 */
  async read() {
    return this.publicView(await this.em.findOne(SubscriptionSettings, { id: ID }))
  }
  async adminRead() {
    return this.adminView(await this.em.findOne(SubscriptionSettings, { id: ID }))
  }
  /** 在事务内锁定配置行，不存在时以 revision 0 新建 */
  private async locked(em: EntityManager) {
    await em.execute(
      `insert into "subscription_settings" ("id", "rates", "revision", "updated_at") values (?, '{}', 0, now()) on conflict ("id") do nothing`,
      [ID],
    )
    return em.findOneOrFail(SubscriptionSettings, { id: ID }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  }
  async saveRates(input: SaveSubscriptionSettingsDto) {
    let rates: Partial<Record<string, string>> = {}
    if (input.baseCurrency) {
      try {
        rates = validateRates({ base: input.baseCurrency, rates: input.rates }).rates
      } catch {
        throw new BadRequestException(msg('subscription.ratesInvalid'))
      }
    } else if (Object.keys(input.rates ?? {}).length) throw new BadRequestException(msg('subscription.ratesInvalid'))
    if (input.ratesUpdatedAt !== null && !isDate(input.ratesUpdatedAt))
      throw new BadRequestException(msg('subscription.dateInvalid'))
    return this.em.transactional(async (em) => {
      const row = await this.locked(em)
      if (row.revision !== input.revision) throw new ConflictException(msg('subscription.settingsChanged'))
      row.baseCurrency = input.baseCurrency
      row.rates = rates
      row.ratesUpdatedAt = input.baseCurrency ? input.ratesUpdatedAt : null
      row.revision++
      row.updatedAt = new Date()
      await em.flush()
      return this.adminView(row)
    })
  }
  /** 生成新令牌（旧链接立即失效）；原文只在此次响应中出现 */
  async rotateCalendarToken() {
    const token = randomBytes(32).toString('base64url')
    return this.em.transactional(async (em) => {
      const row = await this.locked(em)
      row.calendarTokenHash = hashToken(token)
      row.revision++
      row.updatedAt = new Date()
      await em.flush()
      return { ...this.adminView(row), token }
    })
  }
  async disableCalendar() {
    return this.em.transactional(async (em) => {
      const row = await this.locked(em)
      row.calendarTokenHash = null
      row.revision++
      row.updatedAt = new Date()
      await em.flush()
      return this.adminView(row)
    })
  }
  /** 校验令牌后输出全部未删除、未撤回记录的续费日历（含草稿，这是博主自己的日历） */
  async calendar(token: string) {
    const row = await this.em.findOne(SubscriptionSettings, { id: ID })
    const expected = row?.calendarTokenHash ? Buffer.from(row.calendarTokenHash, 'hex') : null
    const actual = Buffer.from(hashToken(token), 'hex')
    if (!expected || expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new NotFoundException(msg('subscription.calendarTokenInvalid'))
    const items = await this.em.find(
      Subscription,
      { deletedAt: null, status: { $ne: 'withdrawn' } },
      { orderBy: { sortOrder: 'DESC', id: 'DESC' } },
    )
    const records = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      currency: item.currency,
      amount: item.amount,
      billingCycle: item.billingCycle,
      subscriptionStatus: item.subscriptionStatus,
      startDate: item.startDate ?? null,
      nextBillingDate: item.nextBillingDate ?? null,
      trialEndDate: item.trialEndDate ?? null,
      endDate: item.endDate ?? null,
      pausedPeriods: item.pausedPeriods ?? [],
      description: item.description,
    }))
    return buildCalendar(records, todayDate(await readSiteTimeZone(this.em)), new Date(), calendarHost())
  }
}
