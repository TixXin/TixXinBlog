/** @file useLocalSubscriptions.ts @description 访客本机订阅闭环，存储失败和跨标签冲突保留输入且不调用后端 */
import { appendPriceHistory } from '@tixxin/subscription-domain'
import { subscriptionForm, subscriptionBody } from '~/features/subscription/editor'
import {
  parseLocalSubscriptions,
  serializeLocalSubscriptions,
  safeSubscriptionUrl,
  subscriptionStorageKey,
  validateLocalFields,
} from '~/features/subscription/local'
import type { LocalSubscription, LocalSubscriptions } from '~/features/subscription/local'
import { writeLocalJson } from '~/utils/localPersistence'
export function useLocalSubscriptions() {
  const data = ref<LocalSubscriptions>({ version: 2, revision: '', items: [] }),
    ready = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref(''),
    conflict = ref(false),
    latest = ref<LocalSubscription | null>(null)
  const editing = ref(false),
    editingId = ref<string | null>(null),
    form = reactive(subscriptionForm()),
    baseline = ref(JSON.stringify(form))
  const dirty = computed(() => editing.value && JSON.stringify(form) !== baseline.value),
    saved = computed(() => data.value.items.find((item) => item.id === editingId.value) ?? null)
  let acceptedRaw: string | null = null,
    alive = true
  function load(preserve = true) {
    try {
      const raw = localStorage.getItem(subscriptionStorageKey),
        next = parseLocalSubscriptions(raw)
      if (preserve && dirty.value && raw !== acceptedRaw) {
        latest.value = next.items.find((item) => item.id === editingId.value) ?? null
        conflict.value = true
        error.value = '另一个标签页修改了本地订阅，当前输入已保留。核对最新记录后再合并。'
        return
      }
      if (preserve && editing.value && editingId.value && raw !== acceptedRaw) {
        const latest = next.items.find((item) => item.id === editingId.value)
        if (!latest) {
          conflict.value = true
          error.value = '正在编辑的记录已被另一标签页删除，当前输入已保留。'
          return
        }
        Object.assign(form, subscriptionForm(latest))
        baseline.value = JSON.stringify(form)
      }
      data.value = next
      acceptedRaw = raw
      ready.value = true
      error.value = ''
      conflict.value = false
      latest.value = null
    } catch (cause) {
      ready.value = false
      error.value = cause instanceof Error ? cause.message : '浏览器存储不可用，当前输入尚未保存。'
    }
  }
  function edit(item?: LocalSubscription) {
    if (saving.value || (dirty.value && !window.confirm('有未保存的本地订阅输入，确定切换吗？'))) return false
    editing.value = true
    editingId.value = item?.id ?? null
    Object.assign(form, subscriptionForm(item))
    baseline.value = JSON.stringify(form)
    notice.value = ''
    return true
  }
  function cancel() {
    if (saving.value || (dirty.value && !window.confirm('放弃当前未保存的本地订阅输入？'))) return false
    editing.value = false
    editingId.value = null
    Object.assign(form, subscriptionForm())
    baseline.value = JSON.stringify(form)
    if (conflict.value) load(false)
    return true
  }
  async function write(transform: (items: LocalSubscription[]) => LocalSubscription[]) {
    // 等待跨标签锁期间读取可以刷新，但当前写入仍只能基于发起时的版本和不可变快照提交。
    const expectedRaw = acceptedRaw
    const snapshot = JSON.parse(JSON.stringify(data.value.items)) as LocalSubscription[]
    const mutate = async () => {
      const current = localStorage.getItem(subscriptionStorageKey)
      if (current !== expectedRaw) {
        latest.value = parseLocalSubscriptions(current).items.find((item) => item.id === editingId.value) ?? null
        conflict.value = true
        throw new Error('另一标签页已修改记录。当前输入已保留，请先核对最新数据。')
      }
      const next = { version: 2 as const, revision: crypto.randomUUID(), items: transform(snapshot) }
      const raw = serializeLocalSubscriptions(next)
      writeLocalJson(subscriptionStorageKey, next)
      if (localStorage.getItem(subscriptionStorageKey) !== raw) {
        conflict.value = true
        throw new Error('本地保存与另一标签页发生冲突，请核对存储中的最新数据。')
      }
      if (alive) {
        data.value = next
        acceptedRaw = raw
      }
    }
    // Web Locks 串行同源写入；不支持的浏览器仍进行写前与写后版本核查。
    if (navigator.locks) await navigator.locks.request('tixxin-subscriptions-write', mutate)
    else await mutate()
  }
  async function save() {
    if (!ready.value || saving.value || conflict.value) return
    saving.value = true
    error.value = ''
    notice.value = ''
    const capture = JSON.stringify(form)
    try {
      const body = subscriptionBody(form, 'draft')
      validateLocalFields(body)
      const original = saved.value,
        now = new Date().toISOString(),
        id = editingId.value ?? crypto.randomUUID()
      if (editingId.value && !original) throw new Error('该记录已删除，不能重新保存为原记录；当前输入仍保留。')
      const item: LocalSubscription = {
        ...body,
        url: safeSubscriptionUrl(body.url),
        id,
        revision: (original?.revision ?? -1) + 1,
        iconMediaId: null,
        iconUrl: null,
        faviconUrl: null,
        publishedAt: null,
        sortOrder: 0,
        priceChangeReason: '',
        createdAt: original?.createdAt ?? now,
        updatedAt: now,
        priceHistory: appendPriceHistory(original?.priceHistory ?? [], body, {
          id: crypto.randomUUID(),
          recordedAt: now,
          reason: body.priceChangeReason,
        }),
      }
      await write((items) => (original ? items.map((record) => (record.id === id ? item : record)) : [...items, item]))
      if (!alive) return
      editingId.value = id
      baseline.value = JSON.stringify(subscriptionForm(item))
      if (capture === JSON.stringify(form)) {
        Object.assign(form, subscriptionForm(item))
        editing.value = false
      }
      notice.value = '已保存到当前浏览器。'
    } catch (cause) {
      if (alive) error.value = cause instanceof Error ? cause.message : '保存失败，当前输入尚未保存。'
    } finally {
      if (alive) saving.value = false
    }
  }
  async function remove(item: LocalSubscription) {
    if (!ready.value || saving.value || conflict.value || !window.confirm(`删除本地订阅「${item.name}」及其价格历史？`))
      return
    if (dirty.value && editingId.value === item.id) {
      error.value = '请先保存或取消当前编辑，再删除这条记录。'
      return
    }
    saving.value = true
    try {
      await write((items) => items.filter((record) => record.id !== item.id))
      if (editingId.value === item.id) {
        editing.value = false
        editingId.value = null
      }
      notice.value = '本地订阅已删除。'
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '删除未完成'
    } finally {
      saving.value = false
    }
  }
  function mergeLatest() {
    const before = JSON.parse(baseline.value) as typeof form
    const localInput = subscriptionForm(form)
    load(false)
    if (!ready.value) return
    if (editingId.value && !saved.value) {
      conflict.value = true
      error.value = '正在编辑的记录已被另一标签页删除。请保留输入，取消后新建记录。'
      return
    }
    const incoming = subscriptionForm(saved.value ?? undefined)
    const merged = { ...incoming }
    // 三方合并：本页没有修改的字段采用最新值，双方均修改时保留已展示供核对的本页输入。
    for (const key of Object.keys(localInput) as (keyof typeof localInput)[]) {
      if (localInput[key] !== before[key]) Object.assign(merged, { [key]: localInput[key] })
    }
    Object.assign(form, merged)
    baseline.value = JSON.stringify(incoming)
    notice.value = '已合并最新记录：保留本页改动，其余字段采用最新值。请核对后手动保存。'
  }
  function storage(event: StorageEvent) {
    if (event.key === subscriptionStorageKey || event.key === null) load()
  }
  function unload(event: BeforeUnloadEvent) {
    if (dirty.value || saving.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    load()
    window.addEventListener('storage', storage)
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(() =>
    saving.value ? false : !dirty.value || window.confirm('本地订阅有未保存输入，确定离开吗？'),
  )
  onScopeDispose(() => {
    alive = false
    if (import.meta.client) {
      window.removeEventListener('storage', storage)
      window.removeEventListener('beforeunload', unload)
    }
  })
  return {
    data,
    ready,
    saving,
    error,
    notice,
    conflict,
    latest,
    editing,
    editingId,
    form,
    dirty,
    saved,
    load,
    edit,
    cancel,
    save,
    remove,
    mergeLatest,
  }
}
