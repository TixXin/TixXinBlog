/** @file useMediaLifecycle.ts @description 媒体工作区生命周期：归属变化时作废、切换与离开保护、首次读取与卸载清理 */
import type { ComputedRef } from 'vue'
import type { MediaWorkspace } from './useMediaWorkspace'

export interface MediaOwnershipDeps {
  closeReferences: () => void
  clearSelection: () => void
  failActiveJobs: (message: string) => void
}

/** 账号或内容上下文变化：丢弃列表、选择、引用与批量结果，终止上传并提示 */
export function watchMediaOwnership(ctx: MediaWorkspace, deps: MediaOwnershipDeps) {
  const { guard } = ctx
  watch(
    [() => ctx.auth.currentUser.value?.id, () => ctx.pageContext.value],
    () => {
      if (!guard.owner || guard.disposed) return
      guard.ownershipVersion++
      guard.requestVersion++
      ctx.ready.value = false
      ctx.pending.value = false
      ctx.items.value = []
      ctx.total.value = 0
      deps.closeReferences()
      deps.clearSelection()
      ctx.batchResults.value = []
      ctx.batchProgress.value = null
      ctx.error.value = ctx.ownershipMessage()
      ctx.uploader.cancel()
      deps.failActiveJobs(ctx.ownershipMessage())
    },
    { flush: 'sync' },
  )
}

export interface MediaPageGuardDeps {
  busy: ComputedRef<boolean>
  hasDirtyMetadata: ComputedRef<boolean>
  discardDrafts: () => void
  load: () => Promise<void>
}

/** 路由切换与离开、刷新关闭的未保存保护，以及挂载时恢复登录后首次读取 */
export function useMediaPageGuards(ctx: MediaWorkspace, deps: MediaPageGuardDeps) {
  const { t, guard } = ctx
  onBeforeRouteUpdate(() => {
    if (ctx.working.value || ctx.uploading.value) return false
    if (!deps.hasDirtyMetadata.value) return true
    if (!window.confirm(t('admin-media.mediaMessages.discardDraftsConfirm'))) return false
    deps.discardDrafts()
    return true
  })
  onBeforeRouteLeave(() => {
    if (!deps.busy.value) return true
    const batch = !!ctx.batchProgress.value
    const leave = window.confirm(
      batch ? t('admin-media.mediaMessages.leaveBatchConfirm') : t('admin-media.mediaMessages.leaveDirtyConfirm'),
    )
    // 选择留下时说明页面为何没有跳转，以及当前任务的状态。
    if (!leave)
      ctx.toast.info(batch ? t('admin-media.mediaMessages.stayBatch') : t('admin-media.mediaMessages.stayDirty'))
    return leave
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!deps.busy.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(async () => {
    window.addEventListener('beforeunload', beforeUnload)
    const actor = ctx.auth.currentUser.value?.id
    const context = ctx.pageContext.value
    const restored = await ctx.auth.restore()
    if (guard.disposed) return
    if ((actor && ctx.auth.currentUser.value?.id !== actor) || ctx.pageContext.value !== context) {
      ctx.error.value = ctx.ownershipMessage()
      return
    }
    if (restored) await deps.load()
    else if (!ctx.selectable) await navigateTo({ path: '/admin/login', query: { next: '/admin/media' } })
    else ctx.error.value = t('admin-media.mediaMessages.loginRequired')
  })
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnload)
    guard.disposed = true
    guard.requestVersion += 1
    guard.ownershipVersion += 1
    ctx.uploader.cancel()
  })
}
