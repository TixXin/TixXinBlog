/** @file editorLifecycle.ts @description 动态编辑器的输入、重新读取与恢复副本操作，以及挂载、离开保护、登录与账号切换和卸载清理 */
import { momentForm } from './editor'
import type { MomentEditable } from './types'
import type { MomentEditorSession } from './editorSession'

export function createMomentActions(s: MomentEditorSession, load: () => Promise<void>) {
  const { form, t } = s
  function change(value: Partial<MomentEditable>) {
    Object.assign(form, value)
    s.error.value = ''
    s.notice.value = ''
  }
  async function reload() {
    if (s.saving.value || (s.dirty.value && !window.confirm(t('admin-content.momentEditor.reloadConfirm')))) return
    s.persistLocal()
    await load()
  }
  function restoreRecovery() {
    const value = s.recovery.value
    if (!value || s.saving.value) return
    Object.assign(form, value.form)
    s.id.value = value.id
    s.revision.value = value.revision
    s.session.requestId = value.requestId
    s.recovery.value = null
    s.notice.value = t('admin-content.momentEditor.recoveryRestored')
  }
  function discardRecovery() {
    try {
      sessionStorage.removeItem(s.key())
      s.recovery.value = null
    } catch {
      s.localError.value = t('admin-content.momentEditor.recoveryDiscardFailed')
    }
  }
  return { change, reload, restoreRecovery, discardRecovery }
}

/** 换账号：保存旧输入副本，清空编辑状态后按新账号重新读取 */
function resetForAccount(s: MomentEditorSession) {
  s.persistLocal()
  s.ready.value = false
  s.id.value = s.initialId
  s.revision.value = null
  s.saved.value = null
  s.serverVersion.value = null
  Object.assign(s.form, momentForm())
  s.markClean()
  s.session.requestId = ''
}

export function useMomentEditorLifecycle(s: MomentEditorSession, load: () => Promise<void>, dispose: () => void) {
  const { auth, session, t } = s
  const unload = (event: BeforeUnloadEvent) => {
    if (s.dirty.value || s.saving.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(() => {
    if (s.saving.value) return false
    if (!s.dirty.value) return true
    s.persistLocal()
    return window.confirm(t('admin-content.momentEditor.leaveConfirm'))
  })
  watch(s.form, s.persistLocal, { deep: true })
  watch(auth.isLoggedIn, (loggedIn) => {
    if (loggedIn && !s.ready.value) void load()
  })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (!next || !session.actor || next === session.actor) return
      resetForAccount(s)
      void load()
    },
  )
  onScopeDispose(() => {
    s.persistLocal()
    session.alive = false
    session.version++
    dispose()
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
}
