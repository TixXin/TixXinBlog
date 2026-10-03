/** @file usePromptSearch.ts @description 提示词搜索在组合输入结束后同步 URL，路由变化和卸载取消尚未提交的输入。 */
import type { RouteLocationRaw } from 'vue-router'

export function usePromptSearch(delay = 250) {
  const route = useRoute(),
    router = useRouter()
  const routeKeyword = () => (typeof route.query.q === 'string' ? route.query.q : '')
  const keyword = ref(routeKeyword())
  let composing = false,
    syncing = false,
    inputVersion = 0,
    timer: ReturnType<typeof setTimeout> | undefined
  let navigation: { fullPath: string; inputVersion: number; preserve: boolean } | undefined

  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }
  async function replace(to: RouteLocationRaw, preserve = false) {
    const ownNavigation = { fullPath: router.resolve(to).fullPath, inputVersion, preserve }
    navigation = ownNavigation
    try {
      const failure = await router.replace(to)
      if (failure && navigation === ownNavigation) navigation = undefined
      return failure
    } catch (cause) {
      if (navigation === ownNavigation) navigation = undefined
      throw cause
    }
  }
  // 页码自动纠正只整理列表地址，不代表用户放弃正在输入的搜索词。
  const replacePreservingInput = (to: RouteLocationRaw) => replace(to, true)
  function submit() {
    cancel()
    if (composing) return
    const q = keyword.value.slice(0, 200).trim()
    if (q === routeKeyword()) return
    void replace({
      path: '/prompts',
      query: { ...route.query, q: q || undefined, page: undefined, prompt: undefined },
    })
  }
  function schedule() {
    cancel()
    if (!composing && !syncing) timer = setTimeout(submit, delay)
  }
  function startComposition() {
    composing = true
    cancel()
  }
  function endComposition(event: CompositionEvent) {
    composing = false
    if (event.target instanceof HTMLInputElement) keyword.value = event.target.value
    schedule()
  }
  watch(
    keyword,
    () => {
      if (!syncing) inputVersion++
      schedule()
    },
    { flush: 'sync' },
  )
  watch(
    () => route.fullPath,
    () => {
      const ownNavigation = navigation?.fullPath === route.fullPath ? navigation : undefined
      navigation = undefined
      // 只识别明确发起的导航；历史和筛选切换仍以 URL 为准，不能仅凭关键词相同保留输入。
      if (ownNavigation && (ownNavigation.preserve || ownNavigation.inputVersion !== inputVersion || composing)) {
        schedule()
        return
      }
      cancel()
      composing = false
      syncing = true
      keyword.value = routeKeyword()
      syncing = false
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    cancel()
    navigation = undefined
  })
  return { keyword, submit, startComposition, endComposition, replacePreservingInput }
}
