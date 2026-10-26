/** @file editorLifecycle.ts @description 站点设置编辑器的生命周期：草稿持久化、账号或内容库切换清场、离开确认与挂载读取 */
import { SITE_EDITOR_I18N as S } from './editorLabels'
import type { SiteEditorSession } from './editorSession'

type Loaders = { load: () => Promise<void>; loadHistory: () => Promise<void> }

/** 账号或内容库变化：保存旧输入副本，作废进行中的请求并清空全部状态 */
function resetForContextChange(s: SiteEditorSession) {
  const { session } = s
  s.persist()
  session.generation++
  s.ready.value = false
  s.pending.value = false
  s.historyPending.value = false
  s.draft.value = null
  s.conflict.value = null
  s.historical.value = null
  s.preserved.value = null
  s.history.value = []
  s.submission.value = null
  s.preservedBase.value = null
  s.baseline.value = ''
  session.actor = ''
  session.ownedContext = ''
  session.unreadableRecovery = false
  s.error.value = s.t(`${S}.contextChanged`)
}

export function useSiteEditorLifecycle(s: SiteEditorSession, { load, loadHistory }: Loaders) {
  const { session, auth, dirty, pending, t } = s
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value || pending.value) {
      s.persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  watch(
    s.draft,
    () => {
      if (s.ready.value) s.persist()
    },
    { deep: true, flush: 'sync' },
  )
  watch(
    [() => auth.currentUser.value?.id, s.context],
    () => {
      if (!session.actor || (session.actor === auth.currentUser.value?.id && session.ownedContext === s.context.value))
        return
      resetForContextChange(s)
    },
    { flush: 'sync' },
  )
  onBeforeRouteLeave(() => !pending.value && (!dirty.value || window.confirm(t(`${S}.leaveConfirm`))))
  onMounted(async () => {
    window.addEventListener('beforeunload', beforeUnload)
    const restored = await auth.restore()
    if (!session.alive) return
    if (restored) {
      await load()
      await loadHistory()
    } else await navigateTo('/admin/login?next=/admin/site')
  })
  onBeforeUnmount(() => {
    s.persist()
    session.alive = false
    session.generation++
    window.removeEventListener('beforeunload', beforeUnload)
  })
}
