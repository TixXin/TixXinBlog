/** @file useMomentDetail.ts @description 动态详情与前后导航独立读取，区分不存在、断连与过期页面 */
export async function useMomentDetail(id: Ref<string>) {
  const repo = useMomentRepository()
  const store = useMomentStore()
  const scope = usePageRequestScope()
  const result = useAsyncData(`moment-detail:${id.value}`, async (_app, { signal }) => {
    const started = store.clock.value
    const generation = store.generation.value
    return {
      note: await repo.detail(id.value, AbortSignal.any([signal, scope.signal])),
      started,
      generation,
      personalized: import.meta.client,
    }
  })
  const navigation = useAsyncData(`moment-navigation:${id.value}`, (_app, { signal }) =>
    repo.navigation(id.value, AbortSignal.any([signal, scope.signal])),
  )
  watch(
    result.data,
    (value) => {
      if (value && value.note.id === id.value && !scope.signal.aborted)
        store.accept([value.note], value.started, value.generation)
    },
    { immediate: true },
  )
  watch(result.error, (value) => {
    if (value?.statusCode === 404) store.forget(id.value)
  })
  onMounted(() => {
    // mounted 可能仍处于 Nuxt 水合期；明确跳过无访客信息的 SSR 缓存。
    if (result.data.value && !result.data.value.personalized)
      void result.refresh({ dedupe: 'cancel', cachedData: undefined })
  })
  await result
  if (result.data.value && result.data.value.generation !== store.generation.value)
    await result.refresh({ dedupe: 'cancel' })
  scope.assertActive()
  if (result.data.value) store.accept([result.data.value.note], result.data.value.started, result.data.value.generation)
  if (result.error.value && (result.error.value.statusCode === 404 || !store.entries.value[id.value])) {
    const missing = result.error.value.statusCode === 404
    throw createError({
      statusCode: missing ? 404 : 502,
      data: { title: missing ? '动态不存在' : '动态加载失败' },
      fatal: true,
    })
  }
  return {
    moment: computed(() => store.entries.value[id.value]),
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
    navigation: navigation.data,
    navigationError: navigation.error,
    refreshNavigation: navigation.refresh,
  }
}
