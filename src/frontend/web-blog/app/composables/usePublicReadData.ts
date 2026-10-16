/** @file usePublicReadData.ts @description 复用 AsyncData 的公开读取生命周期，历史页缓存不进入深响应式 payload */
import type { NuxtApp } from '#app'
import { publicReadCache, publicReadKey, type PublicReadDomain } from '~/utils/publicReadCache'

export function usePublicReadData<T>(
  nuxtKey: string,
  handler: (app: NuxtApp, options: { signal: AbortSignal }) => Promise<T>,
  options: {
    domain: PublicReadDomain
    query?: () => unknown
    kind?: 'list' | 'metadata'
    lazy?: boolean
    immediate?: boolean
    /** 组合分页响应不得给未重读的前缀重新续期。 */
    ttl?: (value: T) => number
  },
) {
  const app = useNuxtApp()
  const cache = publicReadCache(app)
  const key = () => publicReadKey(options.domain, options.query?.())
  const ttl = options.kind === 'metadata' ? 60_000 : 30_000
  const valueTtl = (value: T) => Math.min(ttl, Math.max(0, options.ttl?.(value) ?? ttl))
  const generation = shallowRef(cache.generation(options.domain))
  const retained = shallowRef<{ key: string; value: T }>()
  const servedStale = ref(false)
  const shared = cache.readerCount(nuxtKey) > 0
  const initialHit = !app.isHydrating ? cache.read<T>(key()) : undefined
  let revalidate = initialHit?.stale ?? false
  servedStale.value = revalidate
  let disposed = false
  let started = options.immediate !== false
  let controller: AbortController | undefined
  const result = useAsyncData<T>(
    nuxtKey,
    async (context, { signal }) => {
      const requested = key()
      const version = cache.generation(options.domain)
      controller?.abort()
      controller = new AbortController()
      const ownedSignal = AbortSignal.any([signal, controller.signal])
      const value = await handler(context, { signal: ownedSignal })
      if (ownedSignal.aborted || version !== cache.generation(options.domain)) {
        throw new DOMException('公开读取已失效', 'AbortError')
      }
      cache.put(options.domain, requested, value, version, valueTtl(value))
      retained.value = { key: requested, value }
      servedStale.value = false
      return value
    },
    {
      deep: false,
      lazy: options.lazy ?? false,
      immediate: options.immediate ?? true,
      getCachedData: (_key, context, { cause }) => {
        if (context.isHydrating && context.payload.data[nuxtKey] !== undefined && cause === 'initial') {
          const value = context.payload.data[nuxtKey] as T
          cache.put(options.domain, key(), value, cache.generation(options.domain), valueTtl(value))
          retained.value = { key: key(), value }
          return value
        }
        if (cause !== 'initial' && cause !== 'watch') return undefined
        const hit = cache.read<T>(key())
        if (hit) {
          retained.value = { key: key(), value: hit.value }
          servedStale.value = hit.stale
          revalidate ||= hit.stale
        }
        return hit?.value
      },
    },
  )
  const data = computed(() => result.data.value ?? (retained.value?.key === key() ? retained.value.value : undefined))
  const rawRefresh = result.refresh
  // 同键已有活跃订阅时 Nuxt 不再调用 getCachedData；新订阅仍须遵守历史缓存期限。
  let coldRefresh: Promise<unknown> | undefined
  if (import.meta.client && shared && !app.isHydrating && !initialHit && started && !result.pending.value) {
    result.clear()
    coldRefresh = rawRefresh({ dedupe: 'cancel', cachedData: undefined })
  }
  // Nuxt 同键只持有第一个 handler；每个订阅都观察成功数据，才能在刷新失败时一致保留。
  watch(
    result.data,
    (value) => {
      // 未配置 pick/transform，AsyncData 的 PickFrom 泛型在此仍是 handler 原始结果。
      if (value !== undefined) retained.value = { key: key(), value: value as T }
    },
    { immediate: true, flush: 'sync' },
  )
  async function refresh() {
    started = true
    revalidate = false
    controller?.abort()
    await rawRefresh({ dedupe: 'cancel', cachedData: undefined })
  }
  function backgroundRefresh() {
    if (!revalidate || disposed || !started || import.meta.server) return
    revalidate = false
    void nextTick(() => {
      if (!disposed && !result.pending.value) void refresh()
    })
  }
  async function reload() {
    started = true
    controller?.abort()
    // 缓存命中也必须撤销原请求，防止旧条件稍后覆盖即时显示的数据。
    if (result.pending.value) result.clear()
    await rawRefresh({ cause: 'watch', dedupe: 'cancel' })
    backgroundRefresh()
  }
  cache.retain(nuxtKey)
  const unsubscribe = cache.subscribe(options.domain, () => {
    controller?.abort()
    retained.value = undefined
    generation.value = cache.generation(options.domain)
    result.clear()
    if (started && import.meta.client)
      void nextTick(() => {
        if (!disposed && result.status.value === 'idle') void refresh()
      })
  })
  onScopeDispose(() => {
    disposed = true
    unsubscribe()
    cache.release(nuxtKey)
    if (cache.readerCount(nuxtKey) === 0) controller?.abort()
    // 自定义 getCachedData 会关闭 Nuxt 默认清理；仅保留有界缓存中的历史数据。
    if (import.meta.client)
      void nextTick(() => {
        if (cache.readerCount(nuxtKey) === 0) app.runWithContext(() => clearNuxtData(nuxtKey))
      })
  })
  backgroundRefresh()
  const exposed = {
    data,
    pending: result.pending,
    error: result.error,
    status: result.status,
    refresh,
    execute: refresh,
    reload,
    clear: result.clear,
    generation,
    stale: computed(() => servedStale.value && !!data.value),
  }
  return Object.assign(
    Promise.all([result, coldRefresh]).then(() => exposed),
    exposed,
  )
}
