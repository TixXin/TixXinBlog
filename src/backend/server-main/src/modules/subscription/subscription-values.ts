/** @file subscription-values.ts @description 订阅链接、业务日期及编辑值的严格边界 */
import { BadRequestException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import { isIP } from 'node:net'
import { isDate } from '@tixxin/subscription-domain'
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
export function validateSubscriptionDates(value: { startDate?: string | null; nextBillingDate?: string | null }) {
  for (const date of [value.startDate, value.nextBillingDate])
    if (date !== undefined && date !== null && !isDate(date))
      throw new BadRequestException(msg('subscription.dateInvalid'))
  if (value.startDate && value.nextBillingDate && value.nextBillingDate < value.startDate)
    throw new BadRequestException(msg('subscription.nextBillingBeforeStart'))
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
  validateSubscriptionDates(values)
  return values
}
