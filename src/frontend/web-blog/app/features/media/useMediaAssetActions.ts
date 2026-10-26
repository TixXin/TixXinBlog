/** @file useMediaAssetActions.ts @description 媒体单项回收与恢复：回收前查引用，有引用时打开引用面板而不删除 */
import type { MediaAsset, MediaReferences } from './types'
import type { MediaReferencePanel } from './useMediaReferences'
import type { MediaWorkspace } from './useMediaWorkspace'

export function createMediaAssetActions(ctx: MediaWorkspace, panel: MediaReferencePanel, load: () => Promise<void>) {
  const { api, t, working, error } = ctx
  async function remove(asset: MediaAsset) {
    if (working.value || !ctx.allowAction(asset)) return
    const operation = ctx.guard.ownershipVersion
    working.value = true
    try {
      const refs = await api<MediaReferences>(`/admin/media/${asset.id}/references`)
      if (!ctx.ownsOperation(operation)) return
      if (refs.total) {
        panel.closeReferences()
        panel.referenceId.value = asset.id
        panel.references.value = refs
        error.value = t('admin-media.mediaMessages.stillReferenced')
        return
      }
      if (!window.confirm(t('admin-media.mediaMessages.removeConfirm'))) return
      if (!ctx.ownsOperation(operation)) return
      await api(`/admin/media/${asset.id}`, { method: 'DELETE' })
      if (!ctx.ownsOperation(operation)) return
      ctx.toast.success(t('admin-media.mediaMessages.removed'))
      await load()
    } catch (cause) {
      if (ctx.ownsOperation(operation)) error.value = apiErrorMessage(cause, 'admin-media.mediaMessages.removeFailed')
    } finally {
      working.value = false
    }
  }
  async function restore(asset: MediaAsset) {
    if (working.value || !ctx.allowAction(asset)) return
    const operation = ctx.guard.ownershipVersion
    working.value = true
    try {
      await api(`/admin/media/${asset.id}/restore`, { method: 'POST' })
      if (!ctx.ownsOperation(operation)) return
      ctx.toast.success(t('admin-media.mediaMessages.restored'))
      await load()
    } catch {
      if (ctx.ownsOperation(operation)) error.value = t('admin-media.mediaMessages.restoreFailed')
    } finally {
      working.value = false
    }
  }
  return { remove, restore }
}
