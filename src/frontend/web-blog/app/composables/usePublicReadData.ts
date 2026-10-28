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
    /** 可进一步缩短新鲜期；不会改变五分钟历史上限。 */
    ttl?: (value: T) => number
    /** 组合分页以最早未重读前缀的时刻统一计算新鲜期与历史上限。 */
    readAt?: (value: T) => number
    /** 私有实体仍由领域仓储持有；LRU 只接纳公开投影，弱关联索引也计入容量。 */
    cache?: {
      project: (value: T) => unknown
      restore: (value: unknown) => T | undefined
      additionalBytes?: (value: T) => number
    }
  },
) {
  const app = useNuxtApp()
  const cache = publicReadCache(app)
  const key = () => publicReadKey(options.domain, options.query?.())
  const ttl = options.kind === 'metadata' ? 60_000 : 30_000
  const valueTtl = (value: T) => Math.min(ttl, Math.max(0, options.ttl?.(value) ?? ttl))
  function remember(value: T, requested: string, version: number) {
    const projected = options.cache ? options.cache.project(value) : value
    cache.put(
      options.domain,
      requested,
      projected,
      version,
      valueTtl(value),
      options.cache?.additionalBytes?.(value) ?? 0,
      options.readAt?.(value),
    )
  }
  function readCached() {
    const hit = cache.read<unknown>(key())
    if (!hit) return undefined
    const value = options.cache ? options.cache.restore(hit.value) : (hit.value as T)
    return value === undefined ? undefined : { value, stale: hit.stale }
  }
  const generation = shallowRef(cache.generation(options.domain))
  const retained = shallowRef<{ key: string; value: T }>()
  const servedStale = ref(false)
  const shared = cache.readerCount(nuxtKey) > 0
  const initialHit = !app.isHydrating ? readCached() : undefined
  let revalidate = initialHit?.stale ?? false
  servedStale.value = revalidate
  let disposed = false
  let mounted = false
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
      remember(value, requested, version)
      retained.value = { key: requested, value }
      servedStale.value = false
      return value
    },
    {
      deep: false,
      lazy: options.lazy ?? false,
      immediate: options.immediate ?? true,
      // 同键并发订阅（SSR 预取插件、布局、页面）复用进行中的请求；显式刷新仍按调用方传入的 dedupe 执行
      dedupe: 'defer',
      getCachedData: (_key, context, { cause }) => {
        // SSR 预取完成后的订阅和首次水合可复用 payload；手动或 hook 刷新不能被旧结果截断。
        if (
          cause === 'initial' &&
          (import.meta.server || context.ssrContext || context.isHydrating) &&
          context.payload.data[nuxtKey] !== undefined
        ) {
          const value = context.payload.data[nuxtKey] as T
          remember(value, key(), cache.generation(options.domain))
          retained.value = { key: key(), value }
          return value
        }
        // 静态发布：客户端切到预渲染页面时，Nuxt 已把该页 _payload.json 载入 static.data；
        // 服务器部署关闭 payload 提取，static.data 始终为空，行为不变。
        if (
          cause === 'initial' &&
          import.meta.client &&
          !context.isHydrating &&
          context.static.data[nuxtKey] !== undefined
        ) {
          const value = context.static.data[nuxtKey] as T
          remember(value, key(), cache.generation(options.domain))
          retained.value = { key: key(), value }
          return value
        }
        if (cause !== 'initial' && cause !== 'watch') return undefined
        const hit = readCached()
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
    // 懒读取仍由挂载钩子发起，不能让共享键的冷统计重新阻塞页面 setup。
    if (!options.lazy) coldRefresh = rawRefresh({ dedupe: 'cancel', cachedData: undefined })
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
    // lazy 的初始回填在 beforeMount；提前重验证会被随后回填清掉真实错误。
    if (options.lazy && !mounted) return
    revalidate = false
    void nextTick(() => {
      if (!disposed && !result.pending.value) void refresh()
    })
  }
  // 服务端预取插件只有 effectScope，没有组件挂载生命周期。
  if (import.meta.client && !app.ssrContext)
    onMounted(() => {
      mounted = true
      backgroundRefresh()
    })
  async function reload() {
    started = true
    controller?.abort()
    // 缓存命中也必须撤销原请求，防止旧条件稍后覆盖即时显示的数据。
    if (result.pending.value) result.clear()
    await rawRefresh({ cause: 'watch', dedupe: 'cancel' })
    backgroundRefresh()
  }
  function publish(value: T, expectedGeneration: number) {
    // 游标追加已由领域校验查询和实体代次；这里再拒绝失效或离开后的写回。
    if (disposed || expectedGeneration !== cache.generation(options.domain)) return false
    remember(value, key(), expectedGeneration)
    retained.value = { key: key(), value }
    servedStale.value = false
    result.data.value = value as typeof result.data.value
    return true
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
    publish,
    clear: result.clear,
    generation,
    stale: computed(() => servedStale.value && !!data.value),
  }
  return Object.assign(
    Promise.all([result, coldRefresh]).then(() => exposed),
    exposed,
  )
}
