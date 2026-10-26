/** @file usePromptEditorSession.ts @description 提示词页内编辑会话：路由参数联动、焦点保持与保存后列表切换 */
import type { ComputedRef, Ref } from 'vue'
import type { ManagedPrompt } from './types'

export interface PromptEditorSessionOptions {
  isOwner: Ref<boolean>
  ready: Ref<boolean>
  editToken: ComputedRef<string | null>
  draftView: ComputedRef<boolean>
  selectedId: Ref<number | null>
  refresh: () => Promise<unknown>
  refreshMetadata: () => Promise<unknown>
  loadDrafts: () => Promise<unknown>
  readDetail: () => Promise<unknown>
}

/** 焦点已落在编辑器以外的真实元素上，关闭编辑器时不再抢回焦点 */
function focusMovedElsewhere() {
  const active = document.activeElement
  return (
    active instanceof HTMLElement &&
    active !== document.body &&
    active !== document.documentElement &&
    active.isConnected &&
    !active.closest('.prompt-editor, [inert]')
  )
}

/** 打开编辑器时记住入口，关闭后把焦点还给入口；入口已不可用时回到视图切换按钮 */
function createEditorFocus(editorOpen: Ref<boolean>, selectedId: Ref<number | null>) {
  let editorTrigger: HTMLElement | null = null
  function rememberTrigger() {
    editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  async function restoreEditorFocus() {
    await nextTick()
    if (editorOpen.value || selectedId.value !== null || focusMovedElsewhere()) return
    if (editorTrigger?.isConnected && !editorTrigger.closest('[inert]')) editorTrigger.focus({ preventScroll: true })
    else {
      const fallback = document.querySelector<HTMLButtonElement>('.prompts-views button')
      fallback?.focus()
    }
  }
  return { rememberTrigger, restoreEditorFocus }
}

/** 保存后：状态改变时转到对应列表，并刷新列表、元数据与当前详情 */
function createSavedHandler(options: PromptEditorSessionOptions, editorId: Ref<number | null>) {
  const route = useRoute(),
    router = useRouter()
  return async function saved(item: ManagedPrompt) {
    // 状态改变时转到对应列表；关闭编辑器后仍可核对该作品，草稿不会误走公开详情。
    const nextView = item.status === 'draft' ? 'drafts' : undefined
    const switchView = options.draftView.value !== (item.status === 'draft')
    // 保存后的new→id是同一编辑会话，不重建组件，后续输入归属已确认作品。
    editorId.value = item.id
    if (switchView || route.query.edit !== String(item.id))
      await router.replace({
        path: '/prompts',
        query: {
          ...route.query,
          edit: String(item.id),
          view: nextView,
          page: switchView ? undefined : route.query.page,
        },
      })
    await Promise.all([
      options.refresh(),
      options.refreshMetadata(),
      !switchView && options.draftView.value ? options.loadDrafts() : Promise.resolve(),
    ])
    if (!switchView && options.selectedId.value === item.id) await options.readDetail()
  }
}

export function usePromptEditorSession(options: PromptEditorSessionOptions) {
  const { isOwner, ready, editToken, selectedId } = options
  const route = useRoute(),
    router = useRouter()
  const editorOpen = ref(false),
    editorId = ref<number | null>(null),
    editorSession = ref(0)
  let activeEditToken: string | null = null
  const focus = createEditorFocus(editorOpen, selectedId)
  const { restoreEditorFocus } = focus

  function openEditor(id: number | null) {
    if (!isOwner.value) return
    focus.rememberTrigger()
    void router.push({ path: '/prompts', query: { ...route.query, edit: id === null ? 'new' : String(id) } })
  }
  async function closeEditor() {
    // 导航守卫是未保存确认的唯一入口；被取消时URL和编辑器都保持原样。
    await router.replace({ path: '/prompts', query: { ...route.query, edit: undefined } })
  }
  const saved = createSavedHandler(options, editorId)

  watch(
    [isOwner, editToken, ready],
    () => {
      const token = editToken.value
      const sameSession =
        token && (activeEditToken === token || (activeEditToken === 'new' && token === String(editorId.value)))
      if (editorOpen.value && sameSession) {
        activeEditToken = token
        return
      }
      if (!isOwner.value || !ready.value || !token) {
        const wasOpen = editorOpen.value
        editorOpen.value = false
        activeEditToken = null
        if (wasOpen) void restoreEditorFocus()
        return
      }
      activeEditToken = token
      editorId.value = token === 'new' ? null : Number(token)
      editorSession.value++
      editorOpen.value = true
    },
    { immediate: true },
  )

  return { editorOpen, editorId, editorSession, openEditor, closeEditor, saved, restoreEditorFocus }
}
