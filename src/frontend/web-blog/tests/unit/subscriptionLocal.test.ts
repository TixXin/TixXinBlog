/** @file subscriptionLocal.test.ts @description 本机订阅持久化、迁移与冲突回归，不依赖或调用后端 CRUD */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useLocalSubscriptions } from '../../app/composables/useLocalSubscriptions'
import { subscriptionForm, subscriptionBody } from '../../app/features/subscription/editor'
import {
  parseLocalSubscriptions,
  renewLocalSubscription,
  serializeLocalSubscriptions,
  subscriptionStorageKey,
  safeSubscriptionUrl,
} from '../../app/features/subscription/local'
import { filterSubscriptions, subscriptionQuery, publicSubscriptionQuery } from '../../app/features/subscription/query'
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
    clear: () => entries.clear(),
  })
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup() {
  let local!: ReturnType<typeof useLocalSubscriptions>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          local = useLocalSubscriptions()
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  return local
}
async function create(local: ReturnType<typeof useLocalSubscriptions>) {
  local.edit()
  Object.assign(local.form, {
    name: '云端工作台',
    currency: 'USD',
    amountInput: '20',
    startDate: '2026-01-31',
    nextBillingDate: '2026-10-31',
  })
  await local.save()
  expect(local.error.value).toBe('')
  return local.data.value.items[0]!
}
describe('访客订阅本机闭环', () => {
  it.each(['USD', 'JPY'] as const)('新建使用当前显示币种 %s，初始化不构成未保存编辑', async (currency) => {
    const local = await setup()
    expect(local.edit(undefined, currency)).toBe(true)
    expect(local.form.currency).toBe(currency)
    expect(local.dirty.value).toBe(false)
    local.form.name = '正在记录的工具'
    expect(local.dirty.value).toBe(true)
  })
  it('已有记录编辑保留原币种与金额，不被视图的初始币种覆盖', async () => {
    const local = await setup(),
      item = await create(local)
    expect(local.edit(item, 'JPY')).toBe(true)
    expect(local.form.currency).toBe('USD')
    expect(local.form.amountInput).toBe('20.00')
    expect(local.dirty.value).toBe(false)
    expect(local.saved.value?.priceHistory).toEqual(item.priceHistory)
  })
  it('保存并刷新恢复日期和初始价格，文字编辑不变价，价格修改原子追加历史', async () => {
    const local = await setup(),
      item = await create(local)
    expect(item.amount).toBe(2000)
    expect(item.priceHistory).toHaveLength(1)
    expect(item.priceHistory[0]!.effectiveAt).not.toBe('2026-01-31')
    wrappers.pop()!.unmount()
    const reopened = await setup()
    expect(reopened.data.value.items[0]!.nextBillingDate).toBe('2026-10-31')
    reopened.edit(reopened.data.value.items[0]!)
    reopened.form.description = '新的介绍'
    await reopened.save()
    expect(reopened.data.value.items[0]!.priceHistory).toHaveLength(1)
    reopened.edit(reopened.data.value.items[0]!)
    Object.assign(reopened.form, { amountInput: '25.50', priceChangeReason: '调整套餐' })
    await reopened.save()
    expect(reopened.data.value.items[0]!.priceHistory).toHaveLength(2)
    expect(reopened.data.value.items[0]!.priceHistory[1]).toMatchObject({ amount: 2550, reason: '调整套餐' })
    expect(parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey)).items[0]!.amount).toBe(2550)
  })
  it('存储配额不足时不改变记录，不提示成功且保留输入', async () => {
    const local = await setup()
    local.edit()
    Object.assign(local.form, { name: '未保存的工具', amountInput: '12.50' })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await local.save()
    expect(local.error.value).toContain('尚未保存')
    expect(local.notice.value).toBe('')
    expect(local.data.value.items).toHaveLength(0)
    expect(local.form.name).toBe('未保存的工具')
    expect(local.dirty.value).toBe(true)
  })
  it('损坏或未来版本保持原文且阻止覆盖', async () => {
    const raw = '{"version":99,"items":[]}'
    localStorage.setItem(subscriptionStorageKey, raw)
    const local = await setup()
    expect(local.ready.value).toBe(false)
    expect(local.error.value).toContain('不兼容')
    await local.save()
    expect(localStorage.getItem(subscriptionStorageKey)).toBe(raw)
  })
  it('跨标签页冲突阻止覆盖，显式合并后保留本机编辑并使用最新历史', async () => {
    const first = await setup(),
      item = await create(first),
      second = await setup()
    first.edit(item)
    first.form.description = '第一标签页输入'
    second.edit(second.data.value.items[0]!)
    second.form.amountInput = '30'
    await second.save()
    window.dispatchEvent(new StorageEvent('storage', { key: subscriptionStorageKey }))
    await flushPromises()
    expect(first.conflict.value).toBe(true)
    expect(first.form.description).toBe('第一标签页输入')
    await first.save()
    expect(parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey)).items[0]!.amount).toBe(3000)
    first.mergeLatest()
    expect(first.form.description).toBe('第一标签页输入')
    expect(first.form.amountInput).toBe('30.00')
    expect(first.saved.value?.priceHistory).toHaveLength(2)
    await first.save()
    expect(first.data.value.items[0]!.priceHistory).toHaveLength(2)
    expect(first.data.value.items[0]!.description).toBe('第一标签页输入')
  })
  it('三方合并只保留本页变价，未修改的描述使用另一标签页最新值', async () => {
    const local = await setup(),
      item = await create(local),
      second = await setup()
    local.edit(item)
    local.form.amountInput = '25'
    second.edit(second.data.value.items[0]!)
    second.form.description = '另一标签页补充的说明'
    await second.save()
    window.dispatchEvent(new StorageEvent('storage', { key: subscriptionStorageKey }))
    expect(local.latest.value?.description).toBe('另一标签页补充的说明')
    expect(local.form.description).toBe('')
    local.mergeLatest()
    expect(local.form.amountInput).toBe('25')
    expect(local.form.description).toBe('另一标签页补充的说明')
    await local.save()
    expect(local.data.value.items[0]).toMatchObject({ amount: 2500, description: '另一标签页补充的说明' })
  })
  it('尚未修改的编辑表单随外部更新同步，后续保存不覆盖旧金额', async () => {
    const local = await setup(),
      item = await create(local),
      second = await setup()
    local.edit(item)
    second.edit(second.data.value.items[0]!)
    second.form.amountInput = '35'
    await second.save()
    window.dispatchEvent(new StorageEvent('storage', { key: subscriptionStorageKey }))
    expect(local.form.amountInput).toBe('35.00')
    expect(local.dirty.value).toBe(false)
    local.form.description = '随后补充的说明'
    await local.save()
    expect(local.data.value.items[0]!.amount).toBe(3500)
  })
  it('写前版本核查覆盖未收到storage事件的竞态', async () => {
    const local = await setup(),
      item = await create(local)
    local.edit(item)
    local.form.name = '当前标签输入'
    const external = parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey))
    external.revision = crypto.randomUUID()
    external.items[0]!.description = '外部编辑'
    localStorage.setItem(subscriptionStorageKey, JSON.stringify(external))
    await local.save()
    expect(local.conflict.value).toBe(true)
    expect(local.form.name).toBe('当前标签输入')
    expect(parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey)).items[0]!.description).toBe('外部编辑')
  })
  it.each(['save', 'remove'] as const)(
    '等待 Web Locks 时 %s 使用冻结版本，不覆盖或删除随后外部更新的记录',
    async (action) => {
      const local = await setup(),
        item = await create(local),
        second = await setup()
      local.edit(item)
      const priorLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
      let release!: () => Promise<void>
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
          request: (_name: string, callback: () => Promise<void>) =>
            new Promise<void>((resolve, reject) => {
              release = async () => {
                try {
                  await callback()
                  resolve()
                } catch (cause) {
                  reject(cause)
                }
              }
            }),
        },
      })
      try {
        const pending = action === 'save' ? local.save() : local.remove(item)
        await vi.waitFor(() => expect(release).toBeTypeOf('function'))
        // 外部标签正常持锁完成自己的写入，随后此页仍在等待自己的锁。
        if (priorLocks) Object.defineProperty(navigator, 'locks', priorLocks)
        else Reflect.deleteProperty(navigator, 'locks')
        second.edit(second.data.value.items[0]!)
        second.form.amountInput = '99'
        second.form.description = '等待期间外部写入'
        await second.save()
        window.dispatchEvent(new StorageEvent('storage', { key: subscriptionStorageKey }))
        expect(local.data.value.items[0]!.amount).toBe(9900)
        await release()
        await pending
        expect(local.conflict.value).toBe(true)
        const stored = parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey)).items
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ amount: 9900, description: '等待期间外部写入' })
        expect(stored[0]!.priceHistory).toHaveLength(2)
      } finally {
        if (priorLocks) Object.defineProperty(navigator, 'locks', priorLocks)
        else Reflect.deleteProperty(navigator, 'locks')
      }
    },
  )
  it('外部删除不允许以原身份复活正在编辑的条目', async () => {
    const local = await setup(),
      item = await create(local)
    local.edit(item)
    local.form.notes = '待保存'
    localStorage.setItem(
      subscriptionStorageKey,
      JSON.stringify({ version: 2, revision: crypto.randomUUID(), items: [] }),
    )
    local.mergeLatest()
    expect(local.conflict.value).toBe(true)
    expect(local.error.value).toContain('删除')
    await local.save()
    expect(parseLocalSubscriptions(localStorage.getItem(subscriptionStorageKey)).items).toHaveLength(0)
  })
})
describe('访客订阅格式与筛选', () => {
  it('v1 不补造过去价格，只建立迁移时的新快照，非法日期不静默替换', () => {
    const item = {
      ...subscriptionBody(subscriptionForm()),
      id: crypto.randomUUID(),
      name: '旧订阅',
      startDate: '2020-01-01',
    }
    const migrated = parseLocalSubscriptions(JSON.stringify({ version: 1, items: [item] }), '2026-10-13T08:00:00.000Z')
    expect(migrated.version).toBe(2)
    expect(migrated.items[0]!.priceHistory[0]!.effectiveAt).toBe('2026-10-13T08:00:00.000Z')
    expect(() =>
      parseLocalSubscriptions(JSON.stringify({ version: 1, items: [{ ...item, startDate: '2026-02-30' }] })),
    ).toThrow('原始数据已保留')
  })
  it('写入与读取共享条数和总大小上限，不生成刷新后不可读的数据', async () => {
    const local = await setup(),
      item = await create(local)
    const original = localStorage.getItem(subscriptionStorageKey)
    expect(() =>
      serializeLocalSubscriptions({
        version: 2,
        revision: 'bounded',
        items: Array.from({ length: 1001 }, (_, index) => ({ ...item, id: String(index) })),
      }),
    ).toThrow('最多保存 1000 条')
    expect(() =>
      serializeLocalSubscriptions({
        version: 2,
        revision: 'bounded',
        items: Array.from({ length: 500 }, (_, index) => ({
          ...item,
          id: String(index),
          description: '文'.repeat(5000),
          notes: '字'.repeat(5000),
        })),
      }),
    ).toThrow('格式上限')
    expect(localStorage.getItem(subscriptionStorageKey)).toBe(original)
  })
  it('英文界面下本机校验与共享领域错误使用英文提示', async () => {
    const i18n = useNuxtApp().$i18n
    await i18n.setLocale('en')
    try {
      expect(() => parseLocalSubscriptions('{')).toThrow('The original data has been kept')
      expect(() => safeSubscriptionUrl('javascript:alert(1)')).toThrow('unsafe protocol')
      const local = await setup()
      local.edit()
      Object.assign(local.form, { name: 'Cloud IDE', currency: 'JPY', amountInput: '1.5' })
      await local.save()
      expect(local.error.value).toBe('Enter a valid amount')
      Object.assign(local.form, { currency: 'USD', amountInput: '1.505' })
      await local.save()
      expect(local.error.value).toBe('This currency allows at most 2 decimal places')
    } finally {
      await i18n.setLocale('zh-CN')
    }
  })
  it('拒绝危险官网与凭据，金额与币种使用共享领域校验', () => {
    expect(() => safeSubscriptionUrl('javascript:alert(1)')).toThrow()
    expect(() => safeSubscriptionUrl('https://name:secret@example.com')).toThrow()
    expect(() => subscriptionBody({ ...subscriptionForm(), currency: 'JPY', amountInput: '1.5' })).toThrow()
    expect(subscriptionBody({ ...subscriptionForm(), currency: 'JPY', amountInput: '1000' }).amount).toBe(1000)
  })
  it.each([undefined, '', 'BTC', 'usd', ['USD', 'JPY'], null])(
    '公开与本地预算查询对无效币种 %j 默认 USD，后台通用查询仍不限币种',
    (currency) => {
      expect(publicSubscriptionQuery({ currency }).currency).toBe('USD')
      expect(subscriptionQuery({ currency }).currency).toBeUndefined()
    },
  )
  it.each(['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD'])('公开与本地预算完整保留显式币种 %s', (currency) => {
    expect(publicSubscriptionQuery({ currency }).currency).toBe(currency)
  })
  it('默认单币种筛选发生在分页前，通用查询仍保留其它币种记录', async () => {
    const local = await setup(),
      item = await create(local)
    const rows = [
      { ...item, id: 'cny', currency: 'CNY' as const },
      ...Array.from({ length: 13 }, (_, index) => ({ ...item, id: `usd-${index}` })),
    ]
    const filtered = filterSubscriptions(rows, publicSubscriptionQuery({}))
    expect(filtered).toHaveLength(13)
    expect(filtered.every((row) => row.currency === 'USD')).toBe(true)
    expect(filtered.slice(12)).toHaveLength(1)
    expect(filterSubscriptions(rows, subscriptionQuery({}))).toHaveLength(14)
  })
  it('本地查询在分页前筛选，金额排序先区分币种', async () => {
    const local = await setup(),
      item = await create(local)
    const rows = [
      { ...item, id: 'cny', currency: 'CNY' as const, amount: 10000 },
      { ...item, id: 'usd2', amount: 500 },
      item,
    ]
    const filtered = filterSubscriptions(rows, subscriptionQuery({ sort: 'amount-asc' }))
    expect(filtered.map((row) => row.id)).toEqual(['cny', 'usd2', item.id])
    expect(filterSubscriptions(rows, subscriptionQuery({ currency: 'USD' }))).toHaveLength(2)
    expect(subscriptionQuery({ sort: 'default' }).sort).toBe('manual')
  })
})

describe('访客订阅的试用到期、结束日与一键续费', () => {
  it('保存并刷新保留试用到期日与结束日，早于开始日时拒绝且不写入', async () => {
    const local = await setup()
    local.edit()
    Object.assign(local.form, {
      name: '短期工具',
      currency: 'USD',
      amountInput: '8',
      subscriptionStatus: 'trial',
      startDate: '2026-11-01',
      trialEndDate: '2026-11-15',
      endDate: '2027-11-15',
    })
    await local.save()
    expect(local.error.value).toBe('')
    wrappers.pop()!.unmount()
    const reopened = await setup()
    expect(reopened.data.value.items[0]).toMatchObject({ trialEndDate: '2026-11-15', endDate: '2027-11-15' })
    reopened.edit(reopened.data.value.items[0]!)
    reopened.form.endDate = '2026-10-01'
    await reopened.save()
    expect(reopened.error.value).not.toBe('')
    expect(reopened.data.value.items[0]!.endDate).toBe('2027-11-15')
  })
  it('旧记录没有新日期字段时按未填写读取，不提升存储版本', () => {
    const local = parseLocalSubscriptions(serializeLocalSubscriptions({ version: 2, revision: 'r', items: [] }))
    expect(local.items).toEqual([])
    const legacy = JSON.parse(
      serializeLocalSubscriptions({
        version: 2,
        revision: 'r',
        items: [
          {
            ...subscriptionBody(subscriptionForm({ name: '旧记录', currency: 'USD', amountInput: '1' })),
            id: 'a',
            revision: 0,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
            iconUrl: null,
            faviconUrl: null,
            publishedAt: null,
            priceHistory: [
              {
                id: '6459bac0-801f-44cd-91ae-5729bef9a110',
                effectiveAt: '2026-10-01T00:00:00.000Z',
                recordedAt: '2026-10-01T00:00:00.000Z',
                amount: 100,
                currency: 'USD',
                billingCycle: 'monthly',
              },
            ],
          },
        ],
      }),
    )
    for (const item of legacy.items) {
      delete item.trialEndDate
      delete item.endDate
    }
    const parsed = parseLocalSubscriptions(JSON.stringify(legacy))
    expect(parsed.version).toBe(2)
    expect(parsed.items[0]).toMatchObject({ trialEndDate: null, endDate: null })
  })
  it('一键续费按周期推进下次扣费并保留月底锚点，价格历史不变', async () => {
    const local = await setup(),
      item = await create(local)
    expect(renewLocalSubscription({ ...item, nextBillingDate: null }, 'x')).toBeNull()
    await local.renew(item)
    const renewed = local.data.value.items[0]!
    expect(renewed.nextBillingDate).toBe('2026-11-30')
    expect(renewed.revision).toBe(item.revision + 1)
    expect(renewed.priceHistory).toEqual(item.priceHistory)
    expect(local.notice.value).toContain('2026-11-30')
  })
  it('同一条有未保存编辑时拒绝续费，不覆盖输入', async () => {
    const local = await setup(),
      item = await create(local)
    local.edit(item)
    local.form.name = '改到一半'
    await local.renew(item)
    expect(local.error.value).not.toBe('')
    expect(local.data.value.items[0]!.nextBillingDate).toBe('2026-10-31')
    expect(local.form.name).toBe('改到一半')
  })
})
