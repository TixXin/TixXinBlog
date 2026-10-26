/**
 * @file useMediaLibrary.ts
 * @description 媒体工作区的请求、上传队列与草稿保护；展示组件仅通过 props 接收状态和动作。
 *              各项流程由 features/media 下的组合函数实现，这里只负责组装并保持对外返回结构。
 */
import { createMediaAssetActions } from '~/features/media/useMediaAssetActions'
import { createMediaBatchRemoval, createMediaBatchSelection } from '~/features/media/useMediaBatch'
import { createMediaDrafts, createMediaMetadataSave } from '~/features/media/useMediaDrafts'
import { useMediaPageGuards, watchMediaOwnership } from '~/features/media/useMediaLifecycle'
import { createMediaLoader, createMediaNavigation } from '~/features/media/useMediaLoader'
import { createMediaReferences } from '~/features/media/useMediaReferences'
import { createMediaUploadQueue } from '~/features/media/useMediaUploadQueue'
import { createMediaWorkspace } from '~/features/media/useMediaWorkspace'

export function useMediaLibrary(selectable = false) {
  const ctx = createMediaWorkspace(selectable)
  const draftStore = createMediaDrafts()
  const { syncDrafts, discardDrafts, ...drafts } = draftStore
  const { hasDirtyMetadata } = drafts
  const { failActiveJobs, ...upload } = createMediaUploadQueue(ctx, hasDirtyMetadata, () => loader.load())
  const selection = createMediaBatchSelection(ctx, hasDirtyMetadata, upload.jobs)
  const panel = createMediaReferences(ctx)
  const { closeReferences, clearSelection } = { ...panel, ...selection }
  watchMediaOwnership(ctx, { closeReferences, clearSelection, failActiveJobs })
  const loader = createMediaLoader(ctx, { clearSelection, syncDrafts })
  const { load } = loader
  const navigation = createMediaNavigation(ctx, hasDirtyMetadata, load)
  const saving = createMediaMetadataSave(ctx, draftStore)
  const removal = createMediaBatchRemoval(ctx, selection, closeReferences, load)
  const actions = createMediaAssetActions(ctx, panel, load)
  useMediaPageGuards(ctx, { busy: selection.busy, hasDirtyMetadata, discardDrafts, load })
  return {
    ...ctx.state,
    ...drafts,
    ...upload,
    ...panel,
    ...selection,
    ...navigation,
    ...saving,
    ...removal,
    ...actions,
    load,
  }
}
