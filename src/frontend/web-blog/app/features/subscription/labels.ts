/** @file labels.ts @description 订阅分类、周期、状态等枚举的界面名称，以及共享领域包中文校验错误的按语言映射 */
import type { Translate } from '~/utils/format'
import type { SubscriptionCategory, SubscriptionCycle, SubscriptionPublication, SubscriptionState } from './types'

/** 字典 key 不使用连字符，one-time 对应 oneTime */
const cycleKey = (cycle: SubscriptionCycle) => (cycle === 'one-time' ? 'oneTime' : cycle)

export const categoryLabel = (category: SubscriptionCategory, t: Translate) =>
  t(`misc.subscription.category.${category}`)
export const cycleLabel = (cycle: SubscriptionCycle, t: Translate) => t(`misc.subscription.cycle.${cycleKey(cycle)}`)
/** 金额后的周期后缀，如「/ 月」「买断」 */
export const cycleSuffix = (cycle: SubscriptionCycle, t: Translate) =>
  t(`misc.subscription.cycleSuffix.${cycleKey(cycle)}`)
export const stateLabel = (state: SubscriptionState, t: Translate) => t(`misc.subscription.state.${state}`)
export const publicationLabel = (status: SubscriptionPublication, t: Translate) =>
  t(`misc.subscription.publication.${status}`)

/** @tixxin/subscription-domain 抛出的固定中文消息与字典 key 对照；共享包本身不改 */
const DOMAIN_ERRORS: Record<string, string> = {
  计费日期或锚点无效: 'billingAnchorInvalid',
  计费日期超出范围: 'billingDateOutOfRange',
  不支持的币种: 'currencyUnsupported',
  金额必须是范围内的非负整数最小单位: 'amountUnitInvalid',
  请输入有效金额: 'amountInvalid',
  金额超出范围: 'amountOutOfRange',
  价格信息无效: 'pricingInvalid',
  计费周期无效: 'cycleInvalid',
  价格历史核对时间无效: 'historyReferenceInvalid',
  '价格历史必须包含初始价格且不能超过 10000 条': 'historyLength',
  价格历史包含未知字段: 'historyUnknownField',
  价格事件标识无效或重复: 'historyIdInvalid',
  价格事件时间无效: 'historyTimeInvalid',
  价格历史顺序或价格变化无效: 'historyOrderInvalid',
  价格变更原因无效: 'historyReasonInvalid',
  当前价格与末次价格历史不一致: 'historyMismatch',
  统计金额超出安全范围: 'statsOverflow',
  统计日期无效: 'statsDateInvalid',
  订阅分类或状态无效: 'categoryOrStatusInvalid',
  订阅日期无效: 'dateInvalid',
  下次扣费不能早于订阅开始日期: 'nextBeforeStart',
}

/**
 * 把错误转成当前语言的提示：共享领域包的已知中文消息按字典翻译，
 * 其余 Error（本模块已按语言生成的消息）原样返回，非 Error 返回 null 交给调用方兜底。
 */
export function subscriptionErrorMessage(cause: unknown, t: Translate): string | null {
  if (!(cause instanceof Error)) return null
  const key = DOMAIN_ERRORS[cause.message]
  if (key) return t(`misc.subscription.domain.${key}`)
  const digits = /^该币种最多支持 (\d+) 位小数$/.exec(cause.message)?.[1]
  if (digits !== undefined) return t('misc.subscription.domain.fractionDigits', { digits })
  return cause.message
}
