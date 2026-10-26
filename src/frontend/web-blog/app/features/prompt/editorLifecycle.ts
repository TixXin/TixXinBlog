/** @file editorLifecycle.ts @description 页内提示词编辑器的冲突合并与关闭确认，以及挂载、切换与离开保护、归属变化和卸载清理 */
import { promptForm } from './editor'
import type { PromptEditorSession } from './editorSession'
import { promptId } from './query'

export function createPromptActions(s: PromptEditorSession) {
  const { t, persistence } = s
  function merge() {
    const latest = s.serverVersion.value
    if (!latest || s.saving.value || !s.ready.value) return
    s.revision.value = latest.revision
    s.markClean(promptForm(latest))
    s.serverVersion.value = null
    s.error.value = ''
    s.notice.value = t('misc.prompt.editorState.merged')
    persistence.persist()
  }
  function canClose() {
    if (s.saving.value) return false
    if (!s.dirty.value && !s.pendingCreate.value) return true
    const preserved = persistence.persist()
    return window.confirm(
      preserved ? t('misc.prompt.editorState.closeConfirm') : t('misc.prompt.editorState.closeConfirmUnsaved'),
    )
  }
  return { merge, canClose }
}

const editToken = (value: unknown) => (value === 'new' ? 'new' : (promptId(value)?.toString() ?? null))

export function usePromptEditorLifecycle(s: PromptEditorSession, load: () => Promise<void>, canClose: () => boolean) {
  const { auth, meta, persistence, t } = s
  const unload = (event: BeforeUnloadEvent) => {
    if (s.dirty.value || s.saving.value || s.pendingCreate.value) {
      persistence.persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(canClose)
  onBeforeRouteUpdate((to, from) => {
    const previous = editToken(from.query.edit),
      next = editToken(to.query.edit)
    if (previous === next) return true
    // 同一份新建作品确认保存后，URL归属真实编号；页内筛选和状态切换也不离开编辑会话。
    if (previous === 'new' && s.id.value !== null && next === String(s.id.value)) return true
    return canClose()
  })
  watch(s.form, persistence.persist, { deep: true })
  watch([() => auth.currentUser.value?.id, () => auth.isLoggedIn.value, s.context], () => {
    const lost =
      !auth.isLoggedIn.value || auth.currentUser.value?.id !== meta.actor || s.context.value !== meta.ownedContext
    if (!meta.actor || !lost) return
    persistence.persist()
    meta.generation++
    s.ready.value = false
    s.saving.value = false
    s.loading.value = false
    s.error.value = t('misc.prompt.editorState.ownershipLost')
  })
  onScopeDispose(() => {
    persistence.persist()
    meta.alive = false
    meta.generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
}
