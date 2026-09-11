/** @file useAdminReadResource.ts @description 管理只读面板共享请求归属与失败保留，账号/内容代次变化后丢弃旧结果 */
export function useAdminReadResource<T>(read: () => Promise<T>, message = '读取失败，请重试') {
  const auth = useCurrentUser(),
    route = useRoute()
  const context = useState<string>('page-content-context', () => '')
  const data = shallowRef<T | null>(null),
    pending = ref(false),
    error = ref('')
  let generation = 0,
    ownerGeneration = 0,
    alive = true,
    started = false
  function captureOwnership(includeRoute = true) {
    const version = ownerGeneration,
      actor = auth.currentUser.value?.id,
      ownedContext = context.value,
      path = route.fullPath
    return () =>
      alive &&
      version === ownerGeneration &&
      actor === auth.currentUser.value?.id &&
      ownedContext === context.value &&
      (!includeRoute || path === route.fullPath)
  }
  async function refresh() {
    if (!alive || !started || !auth.currentUser.value) return
    const version = ++generation,
      owner = captureOwnership(false)
    const owns = () => version === generation && owner()
    pending.value = true
    error.value = ''
    try {
      const value = await read()
      if (owns()) data.value = value
    } catch {
      if (owns()) error.value = message
    } finally {
      if (owns()) pending.value = false
    }
  }
  watch(
    [() => auth.currentUser.value?.id, context],
    () => {
      if (!started) return
      ownerGeneration++
      generation++
      data.value = null
      pending.value = false
      error.value = ''
      if (auth.currentUser.value) void refresh()
    },
    { flush: 'sync' },
  )
  onMounted(async () => {
    if (!(await auth.restore())) {
      if (alive) await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
      return
    }
    if (!alive) return
    started = true
    await refresh()
  })
  onScopeDispose(() => {
    alive = false
    generation++
  })
  return { data, pending, error, refresh, captureOwnership }
}
