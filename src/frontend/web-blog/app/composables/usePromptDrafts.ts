/** @file usePromptDrafts.ts @description 私有草稿读取：身份和内容库同步隔离，同一身份的筛选保留上次成功结果 */
import type { ComputedRef } from 'vue'
import type { ManagedPrompt, PromptPage, PromptQuery } from '~/features/prompt/types'

export function usePromptDrafts(query: ComputedRef<PromptQuery>, enabled: ComputedRef<boolean>) {
  const repo = usePromptRepository(),
    auth = useCurrentUser(),
    context = useState<string>('page-content-context', () => '')
  const drafts = ref<PromptPage<ManagedPrompt> | null>(null),
    pending = ref(false),
    error = ref('')
  const queryKey = computed(() => JSON.stringify(query.value))
  const acceptedKey = ref('')
  let generation = 0,
    alive = true,
    owner = auth.currentUser.value?.id,
    ownedContext = context.value

  function clear() {
    drafts.value = null
    acceptedKey.value = ''
    error.value = ''
    pending.value = false
  }

  async function refresh() {
    const version = ++generation
    const actor = auth.currentUser.value?.id,
      library = context.value
    // 清理发生在第一个 await 之前，身份切换不会在下一帧留下旧账号的草稿。
    if (owner !== actor || ownedContext !== library || !enabled.value || !actor) clear()
    owner = actor
    ownedContext = library
    if (!alive || !enabled.value || !actor) return
    const key = queryKey.value,
      request = { ...query.value, status: 'draft' }
    const owns = () =>
      alive &&
      version === generation &&
      enabled.value &&
      auth.currentUser.value?.id === actor &&
      context.value === library &&
      queryKey.value === key
    pending.value = true
    error.value = ''
    try {
      const result = await repo.adminList(request)
      if (!owns()) return
      acceptedKey.value = key
      drafts.value = result
    } catch (cause) {
      if (owns()) error.value = cause instanceof Error ? cause.message : '草稿读取失败，请重试。'
    } finally {
      if (owns()) pending.value = false
    }
  }

  watch([queryKey, enabled, () => auth.currentUser.value?.id, context], () => void refresh(), {
    immediate: true,
    flush: 'sync',
  })
  onScopeDispose(() => {
    alive = false
    generation++
    clear()
  })

  return {
    drafts,
    pending,
    error,
    stale: computed(() => !!drafts.value && (acceptedKey.value !== queryKey.value || pending.value || !!error.value)),
    refresh,
  }
}
