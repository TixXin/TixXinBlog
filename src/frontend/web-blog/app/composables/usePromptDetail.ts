/** @file usePromptDetail.ts @description 公开详情复用 SSR payload；草稿仅在客户端读取，导航与身份变化隔离迟到结果。 */
import type { Ref } from 'vue'
import type { ImagePrompt, ManagedPrompt } from '~/features/prompt/types'
import { promptId } from '~/features/prompt/query'

export const PROMPT_DETAIL_DATA_KEY = 'prompt-public-detail'
interface PublicDetailSnapshot {
  key: string
  item: ImagePrompt | null
  error: string
}

export async function usePromptDetail(ready: Ref<boolean>, draftView: Ref<boolean>) {
  const route = useRoute(),
    repo = usePromptRepository(),
    auth = useCurrentUser(),
    scope = usePageRequestScope()
  const context = useState<string>('page-content-context', () => '')
  const mounted = ref(false)
  const selectedId = computed(() => promptId(route.query.prompt))
  // 即使 SSR 无法恢复登录态，也不能把草稿/编辑地址当成公开详情读取。
  const privateRoute = computed(() => route.query.view === 'drafts' || route.query.edit !== undefined)
  const publicTarget = computed(() => (privateRoute.value ? null : selectedId.value))
  const ownerKey = computed(() =>
    JSON.stringify({
      id: selectedId.value,
      private: privateRoute.value,
      actor: auth.currentUser.value?.id ?? null,
      context: context.value,
    }),
  )
  let generation = 0,
    alive = true,
    publicController: AbortController | undefined
  const privateResult = ref<{ key: string; item: ManagedPrompt | null; error: string } | null>(null)
  const privatePending = ref(false)
  const publicData = useAsyncData<PublicDetailSnapshot>(PROMPT_DETAIL_DATA_KEY, async (_app, { signal }) => {
    const key = ownerKey.value,
      id = publicTarget.value
    if (!id) return { key, item: null, error: '' }
    const controller = new AbortController()
    publicController = controller
    try {
      const item = await repo.detail(id, AbortSignal.any([scope.signal, signal, controller.signal]))
      return { key, item, error: '' }
    } catch (cause) {
      return { key, item: null, error: cause instanceof Error ? cause.message : '提示词读取失败，请重试。' }
    }
  })
  const adminMode = computed(() => privateRoute.value && draftView.value && !!auth.currentUser.value)
  const selectedItem = computed(() => {
    if (adminMode.value) return privateResult.value?.key === ownerKey.value ? privateResult.value.item : null
    if (!publicTarget.value) return null
    return publicData.data.value?.key === ownerKey.value ? publicData.data.value.item : null
  })
  const selectedDraft = computed(
    () => adminMode.value && (selectedItem.value as ManagedPrompt | null)?.status === 'draft',
  )
  const detailError = computed(() => {
    if (adminMode.value) return privateResult.value?.key === ownerKey.value ? privateResult.value.error : ''
    if (!publicTarget.value) return ''
    return publicData.data.value?.key === ownerKey.value ? publicData.data.value.error : ''
  })
  const detailPending = computed(() =>
    adminMode.value ? privatePending.value : !!publicTarget.value && publicData.pending.value,
  )
  async function readDetail() {
    const current = ++generation,
      key = ownerKey.value,
      id = selectedId.value
    publicController?.abort()
    privateResult.value = null
    privatePending.value = false
    if (!alive || !id || (import.meta.client && (!mounted.value || !ready.value))) return
    if (publicTarget.value) {
      await publicData.refresh({ dedupe: 'cancel', cachedData: undefined })
      return
    }
    if (import.meta.server || !adminMode.value) return
    privatePending.value = true
    try {
      const item = await repo.adminDetail(id)
      if (alive && current === generation && ownerKey.value === key) privateResult.value = { key, item, error: '' }
    } catch (cause) {
      if (alive && current === generation && ownerKey.value === key)
        privateResult.value = {
          key,
          item: null,
          error: cause instanceof Error ? cause.message : '提示词读取失败，请重试。',
        }
    } finally {
      if (alive && current === generation && ownerKey.value === key) privatePending.value = false
    }
  }
  watch(
    [ownerKey, ready, mounted, draftView],
    ([key], previous) => {
      ++generation
      publicController?.abort()
      privateResult.value = null
      privatePending.value = false
      if (!mounted.value || !ready.value) return
      // 相同 SSR 目标（包括真实失败）直接复用 payload；挂载不重新读取一次。
      if (publicTarget.value && publicData.data.value?.key === key && previous?.[0] === key) return
      void readDetail()
    },
    { flush: 'sync' },
  )
  onMounted(() => {
    mounted.value = true
  })
  onScopeDispose(() => {
    alive = false
    generation++
    publicController?.abort()
  })
  await publicData
  scope.assertActive()
  return { selectedId, selectedItem, selectedDraft, detailPending, detailError, readDetail }
}
