/** @file subscription-values.ts @description 订阅链接、业务日期及编辑值的严格边界 */
import { BadRequestException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import { isIP } from 'node:net'
import { isDate, validatePausedPeriods } from '@tixxin/subscription-domain'
import type { PausedPeriod } from '@tixxin/subscription-domain'
import type { SaveSubscriptionDto } from './subscription.dto'
export function subscriptionId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647)
    throw new BadRequestException(msg('subscription.idInvalid'))
}
export function subscriptionUrl(input: string): string {
  if (
    typeof input !== 'string' ||
    input.length > 2048 ||
    /[\\\s]/u.test(input) ||
    [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new BadRequestException(msg('subscription.urlMalformed'))
  try {
    const url = new URL(input)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !url.hostname)
      throw new Error('invalid')
    if (url.href.length > 2048) throw new Error('invalid')
    return url.href
  } catch {
    throw new BadRequestException(msg('subscription.urlInvalid'))
  }
}
export function faviconDomain(input: string): string {
  const domain = new URL(subscriptionUrl(input)).hostname.toLowerCase()
  if (
    isIP(domain) ||
    domain.startsWith('[') ||
    domain.length > 253 ||
    !domain.includes('.') ||
    domain.split('.').some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)) ||
    /(?:^|\.)(?:localhost|local|internal|invalid|test|example|onion)$/.test(domain) ||
    /^\d+(?:\.\d+)*$/.test(domain)
  )
    throw new BadRequestException(msg('subscription.faviconDomainInvalid'))
  return domain
}
type SubscriptionDates = Partial<
  Record<'startDate' | 'nextBillingDate' | 'trialEndDate' | 'endDate', string | null>
> & {
  pausedPeriods?: PausedPeriod[]
}
export function validateSubscriptionDates(value: SubscriptionDates) {
  for (const date of [value.startDate, value.nextBillingDate, value.trialEndDate, value.endDate])
    if (date !== undefined && date !== null && !isDate(date))
      throw new BadRequestException(msg('subscription.dateInvalid'))
  const start = value.startDate
  for (const [date, key] of [
    [value.nextBillingDate, 'subscription.nextBillingBeforeStart'],
    [value.trialEndDate, 'subscription.trialEndBeforeStart'],
    [value.endDate, 'subscription.endBeforeStart'],
  ] as const)
    if (start && date && date < start) throw new BadRequestException(msg(key))
  if (value.pausedPeriods === undefined) return
  try {
    validatePausedPeriods(value.pausedPeriods, value.startDate ?? null)
  } catch {
    throw new BadRequestException(msg('subscription.pausedPeriodsInvalid'))
  }
}
export function subscriptionValues(input: SaveSubscriptionDto) {
  const values = Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => !['requestId', 'revision', 'priceChangeReason'].includes(key) && value !== undefined,
    ),
  ) as Omit<SaveSubscriptionDto, 'requestId' | 'revision' | 'priceChangeReason'>
  if (values.url) values.url = subscriptionUrl(values.url)
  else if (values.url !== undefined) values.url = null
  if (values.platform !== undefined) values.platform = values.platform?.trim() || null
  if (values.planName !== undefined) values.planName = values.planName?.trim() || null
  if (values.paymentMethod !== undefined) values.paymentMethod = values.paymentMethod?.trim() || null
  validateSubscriptionDates(values)
  // 区间规范化（缺省的 to 补为 null），保证存储与内容包哈希稳定
  if (values.pausedPeriods !== undefined) values.pausedPeriods = validatePausedPeriods(values.pausedPeriods)
  return values
}
