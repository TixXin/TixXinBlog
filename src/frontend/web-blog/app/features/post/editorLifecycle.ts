/** @file editorLifecycle.ts @description 文章编辑的生命周期：挂载读取、本机副本与草稿自动保存计时、页面隐藏写本机副本、路由与浏览器离开提示 */
import type { AdminPostDraft } from './adminTypes'
import type { PostEditorSession } from './editorSession'
import { persistLocal } from './editorVersions'

/** 草稿内容变化后 400ms 写本机副本；未暂停、无冲突且不在审阅发布时，15s 后自动保存草稿到服务器 */
function scheduleSaves(
  s: PostEditorSession,
  save: (status: AdminPostDraft['status'], automatic?: boolean) => Promise<void>,
) {
  clearTimeout(s.session.localTimer)
  clearTimeout(s.session.serverTimer)
  if (!s.ready.value || !s.dirty.value) return
  s.session.localTimer = setTimeout(() => persistLocal(s), 400)
  if (
    s.serverAutoSave.value &&
    !s.autoSavePaused.value &&
    !s.conflict.value &&
    !s.reviewingPublication.value &&
    s.draft.value.status === 'draft'
  ) {
    s.session.serverTimer = setTimeout(() => {
      if (!s.pending.value && s.dirty.value && s.draft.value.title.trim() && s.draft.value.contentRaw.trim())
        void save('draft', true)
    }, 15000)
  }
}

export function usePostEditorLifecycle(
  s: PostEditorSession,
  actions: {
    load: () => Promise<void>
    save: (status: AdminPostDraft['status'], automatic?: boolean) => Promise<void>
  },
) {
  onMounted(actions.load)
  watch([s.snapshot, s.serverAutoSave, s.autoSavePaused, s.reviewingPublication], () => scheduleSaves(s, actions.save))
  function onPageHidden() {
    if (document.visibilityState === 'hidden') persistLocal(s)
  }
  onBeforeRouteLeave(() => !s.dirty.value || window.confirm(s.t('admin-content.postSave.leaveConfirm')))
  // 路由守卫无法覆盖浏览器刷新与关闭标签页，使用原生离开提示保护未保存内容。
  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!s.dirty.value) return
    persistLocal(s)
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => {
    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('visibilitychange', onPageHidden)
  })
  onBeforeUnmount(() => {
    persistLocal(s)
    clearTimeout(s.session.localTimer)
    clearTimeout(s.session.serverTimer)
    window.removeEventListener('beforeunload', warnBeforeUnload)
    document.removeEventListener('visibilitychange', onPageHidden)
  })
}
