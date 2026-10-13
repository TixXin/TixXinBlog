/** @file editor.ts @description 订阅字段白名单、精确金额输入及上下文恢复副本 */
import { amountInput, parseAmount } from '@tixxin/subscription-domain'
import { categoryLabels, cycleLabels, stateLabels, publicationLabels, currencyOptions } from './types'
import type { ManagedSubscription, SubscriptionEditable, SubscriptionForm } from './types'
export function subscriptionForm(value?: Partial<SubscriptionEditable> & Partial<SubscriptionForm>): SubscriptionForm {
  return {
    name: value?.name ?? '',
    description: value?.description ?? '',
    url: value?.url ?? null,
    platform: value?.platform ?? null,
    category: value?.category ?? 'other',
    currency: value?.currency ?? 'CNY',
    amountInput: value?.amountInput ?? amountInput(value?.amount ?? 0, value?.currency ?? 'CNY'),
    billingCycle: value?.billingCycle ?? 'monthly',
    startDate: value?.startDate ?? null,
    nextBillingDate: value?.nextBillingDate ?? null,
    subscriptionStatus: value?.subscriptionStatus ?? 'active',
    notes: value?.notes ?? '',
    iconMediaId: value?.iconMediaId ?? null,
    status: value?.status ?? 'draft',
    sortOrder: value?.sortOrder ?? 0,
    priceChangeReason: value?.priceChangeReason ?? '',
  }
}
export function subscriptionBody(value: SubscriptionForm, status = value.status): SubscriptionEditable {
  const { amountInput: input, ...fields } = subscriptionForm(value)
  return { ...fields, name: fields.name.trim(), amount: parseAmount(input, fields.currency), status }
}
export function validSubscriptionForm(value: unknown): value is SubscriptionForm {
  if (!value || typeof value !== 'object') return false
  const v = value as SubscriptionForm
  return (
    typeof v.name === 'string' &&
    v.name.length <= 160 &&
    typeof v.description === 'string' &&
    v.description.length <= 5000 &&
    typeof v.notes === 'string' &&
    v.notes.length <= 5000 &&
    typeof v.amountInput === 'string' &&
    v.amountInput.length <= 40 &&
    currencyOptions.includes(v.currency) &&
    Object.hasOwn(categoryLabels, v.category) &&
    Object.hasOwn(cycleLabels, v.billingCycle) &&
    Object.hasOwn(stateLabels, v.subscriptionStatus) &&
    Object.hasOwn(publicationLabels, v.status) &&
    Number.isInteger(v.sortOrder) &&
    Math.abs(v.sortOrder) <= 1000000 &&
    [v.url, v.platform, v.startDate, v.nextBillingDate, v.iconMediaId].every(
      (field) => field === null || typeof field === 'string',
    ) &&
    (v.priceChangeReason === undefined || typeof v.priceChangeReason === 'string')
  )
}
export interface SubscriptionRecovery {
  version: 1
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: SubscriptionForm
  pendingCreate: SubscriptionEditable | null
  savedAt: string
}
export function parseSubscriptionRecovery(raw: string | null): SubscriptionRecovery | null {
  if (!raw || raw.length > 100000) return null
  try {
    const v = JSON.parse(raw) as SubscriptionRecovery
    if (
      v.version !== 1 ||
      typeof v.context !== 'string' ||
      typeof v.requestId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(v.requestId) ||
      typeof v.savedAt !== 'string' ||
      (v.id !== null && (!Number.isSafeInteger(v.id) || v.id < 1)) ||
      (v.revision !== null && (!Number.isSafeInteger(v.revision) || v.revision < 0)) ||
      !validSubscriptionForm(v.form) ||
      (v.pendingCreate !== null &&
        (!validSubscriptionForm(subscriptionForm(v.pendingCreate)) ||
          !Number.isSafeInteger(v.pendingCreate.amount) ||
          v.pendingCreate.amount < 0))
    )
      return null
    return {
      ...v,
      form: subscriptionForm(v.form),
      pendingCreate: v.pendingCreate ? subscriptionBody(subscriptionForm(v.pendingCreate)) : null,
    }
  } catch {
    return null
  }
}
export function priceChanged(value: SubscriptionForm, saved: ManagedSubscription | null) {
  if (!saved) return false
  try {
    return (
      parseAmount(value.amountInput, value.currency) !== saved.amount ||
      value.currency !== saved.currency ||
      value.billingCycle !== saved.billingCycle
    )
  } catch {
    return true
  }
}
