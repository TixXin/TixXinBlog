/** @file useMediaBatch.ts @description 媒体批量回收：可选条件、勾选与全选、逐项引用预检与删除、进度和结果汇总 */
import type { ComputedRef, Ref } from 'vue'
import { failedRemovalResult, referencedRemovalResult } from './library'
import type { MediaAsset, MediaReferences, MediaRemovalResult } from './types'
import type { MediaUploadJob } from './useMediaUploadQueue'
import type { MediaWorkspace } from './useMediaWorkspace'

/** 工作区忙碌（提交、上传、未保存草稿或待传文件）时禁止批量选择、选用与离开 */
export function createMediaBatchSelection(
  ctx: MediaWorkspace,
  hasDirtyMetadata: ComputedRef<boolean>,
  jobs: Ref<MediaUploadJob[]>,
) {
  const { items, ready, pending, working, uploading, deleted } = ctx
  const selectedIds = ref<string[]>([])
  const busy = computed(
    () => working.value || uploading.value || hasDirtyMetadata.value || jobs.value.some((job) => !!job.file),
  )
  const selectableItems = computed(() => items.value.filter((asset) => !asset.deleted))
  const allSelected = computed(
    () =>
      selectableItems.value.length > 0 && selectableItems.value.every((asset) => selectedIds.value.includes(asset.id)),
  )
  const someSelected = computed(() => selectedIds.value.length > 0 && !allSelected.value)
  const canBatchSelect = computed(
    () =>
      !ctx.selectable &&
      deleted.value === 'false' &&
      ready.value &&
      ctx.ownsWorkspace() &&
      !pending.value &&
      !busy.value,
  )
  function clearSelection() {
    selectedIds.value = []
  }
  function toggleSelection(asset: MediaAsset) {
    if (!canBatchSelect.value || !ctx.allowAction(asset) || asset.deleted) return
    selectedIds.value = selectedIds.value.includes(asset.id)
      ? selectedIds.value.filter((id) => id !== asset.id)
      : [...selectedIds.value, asset.id]
  }
  function toggleAll() {
    if (!canBatchSelect.value || !ctx.allowAction()) return
    selectedIds.value = allSelected.value ? [] : selectableItems.value.map((asset) => asset.id)
  }
  function canSelect(asset: MediaAsset) {
    return (
      ready.value &&
      ctx.ownsWorkspace() &&
      items.value.includes(asset) &&
      !asset.deleted &&
      !pending.value &&
      !busy.value
    )
  }
  const state = { selectedIds, allSelected, someSelected, canBatchSelect, busy }
  return { ...state, clearSelection, toggleSelection, toggleAll, canSelect }
}

export type MediaBatchSelection = ReturnType<typeof createMediaBatchSelection>

/** 删除失败后补查引用：'stale' 表示归属已变化；null 表示没有查到引用或补查失败 */
async function recheckAfterFailure(ctx: MediaWorkspace, asset: MediaAsset, operation: number) {
  try {
    const refs = await ctx.api<MediaReferences>(`/admin/media/${asset.id}/references`)
    if (!ctx.ownsOperation(operation)) return 'stale'
    return refs.total ? referencedRemovalResult(asset, refs, ctx.t) : null
  } catch {
    // 删除失败后的补查也可能失败；保留失败结果，不推断无引用或自动重试删除。
    return ctx.ownsOperation(operation) ? null : 'stale'
  }
}

/** 回收单个资源；归属变化时返回 undefined，调用方停止批量 */
async function removeBatchAsset(
  ctx: MediaWorkspace,
  asset: MediaAsset,
  operation: number,
): Promise<MediaRemovalResult | undefined> {
  let checked = false
  try {
    const refs = await ctx.api<MediaReferences>(`/admin/media/${asset.id}/references`)
    if (!ctx.ownsOperation(operation)) return
    if (refs.total) return referencedRemovalResult(asset, refs, ctx.t)
    checked = true
    // 预检只用于说明；最终是否可删仍由后端在共享媒体锁内重新检查。
    await ctx.api(`/admin/media/${asset.id}`, { method: 'DELETE' })
    if (!ctx.ownsOperation(operation)) return
    return {
      id: asset.id,
      name: asset.name,
      status: 'removed',
      message: ctx.t('admin-media.mediaMessages.removedResult'),
    }
  } catch (cause) {
    if (!ctx.ownsOperation(operation)) return
    if (checked) {
      const recheck = await recheckAfterFailure(ctx, asset, operation)
      if (recheck === 'stale') return
      if (recheck) return recheck
    }
    return failedRemovalResult(asset, cause, checked, ctx.t)
  }
}

export function createMediaBatchRemoval(
  ctx: MediaWorkspace,
  selection: MediaBatchSelection,
  closeReferences: () => void,
  load: () => Promise<void>,
) {
  const { t, working, error, batchResults, batchProgress } = ctx
  const owns = (operation: number) => ctx.ownsOperation(operation)
  async function removeSelected() {
    if (!selection.canBatchSelect.value || !ctx.allowAction()) return
    const selected = ctx.items.value.filter((asset) => !asset.deleted && selection.selectedIds.value.includes(asset.id))
    if (!selected.length) return
    const operation = ctx.guard.ownershipVersion
    const confirmed = window.confirm(t('admin-media.mediaMessages.batchConfirm', { count: selected.length }))
    if (!confirmed || !owns(operation) || !selection.canBatchSelect.value) return
    working.value = true
    error.value = ''
    closeReferences()
    batchResults.value = []
    batchProgress.value = { completed: 0, total: selected.length }
    try {
      for (const asset of selected) {
        if (!owns(operation)) break
        const result = await removeBatchAsset(ctx, asset, operation)
        if (!result || !owns(operation)) break
        batchResults.value.push(result)
        batchProgress.value = { completed: batchResults.value.length, total: selected.length }
      }
      if (!owns(operation)) return
      const removed = batchResults.value.filter((result) => result.status === 'removed').length
      if (removed) ctx.toast.success(t('admin-media.mediaMessages.batchRemoved', { count: removed }))
      await load()
    } finally {
      working.value = false
      batchProgress.value = null
    }
  }
  return { removeSelected }
}
