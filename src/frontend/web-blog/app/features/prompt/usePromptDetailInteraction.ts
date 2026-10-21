/** @file usePromptDetailInteraction.ts @description 提示词详情阅读浮层的路由驱动、焦点恢复与键盘前后切换 */
import type { ComputedRef, Ref } from 'vue'
import type { ImagePrompt } from './types'

export interface PromptDetailInteractionOptions {
  selectedId: Ref<number | null>
  detailPending: Ref<boolean>
  items: ComputedRef<ImagePrompt[]>
  currentPending: ComputedRef<boolean>
  currentStale: ComputedRef<boolean>
  currentError: ComputedRef<string>
  editorOpen: Ref<boolean>
}

export function usePromptDetailInteraction(options: PromptDetailInteractionOptions) {
  const { selectedId, detailPending, items, currentPending, currentStale, currentError, editorOpen } = options
  const route = useRoute(),
    router = useRouter()

  const navigationIndex = computed(() =>
    !currentPending.value && !currentStale.value && !currentError.value
      ? items.value.findIndex((item) => item.id === selectedId.value)
      : -1,
  )

  function openDetail(id: number) {
    void router.push({ path: '/prompts', query: { ...route.query, prompt: String(id) } })
  }

  function moveDetail(direction: -1 | 1) {
    if (detailPending.value || navigationIndex.value < 0) return
    const next = items.value[navigationIndex.value + direction]
    if (next) void router.replace({ path: '/prompts', query: { ...route.query, prompt: String(next.id) } })
  }

  async function closeDetail() {
    const previousId = selectedId.value
    await router.replace({ path: '/prompts', query: { ...route.query, prompt: undefined } })
    await nextTick()
    if (selectedId.value !== null || editorOpen.value) return
    const card = document.querySelector<HTMLElement>(`[data-focus-key="prompt-open-${previousId}"]`)
    if (card) card.focus({ preventScroll: true })
    else document.querySelector<HTMLButtonElement>('.prompts-views button')?.focus()
  }

  return {
    navigationIndex,
    openDetail,
    moveDetail,
    closeDetail,
  }
}
