/** @file useMediaDrafts.ts @description 媒体替代文本与说明的草稿：未保存改动检测、随列表同步、放弃与逐项保存 */
import type { MediaAsset } from './types'
import type { MediaWorkspace } from './useMediaWorkspace'

type DraftMap = Record<string, string>

/** 未改动的草稿跟随服务端最新值；已改动的草稿保留，只更新已保存值 */
function syncDraft(drafts: DraftMap, saved: DraftMap, id: string, value: string) {
  if (drafts[id] === undefined || drafts[id] === saved[id]) drafts[id] = value
  saved[id] = value
}

export function createMediaDrafts() {
  const altDrafts = reactive<DraftMap>({})
  const savedAlts = reactive<DraftMap>({})
  const hasDirtyAlt = computed(() => Object.entries(altDrafts).some(([id, value]) => value !== savedAlts[id]))
  const descriptionDrafts = reactive<DraftMap>({})
  const savedDescriptions = reactive<DraftMap>({})
  const hasDirtyDescription = computed(() =>
    Object.entries(descriptionDrafts).some(([id, value]) => value !== savedDescriptions[id]),
  )
  const hasDirtyMetadata = computed(() => hasDirtyAlt.value || hasDirtyDescription.value)
  function syncDrafts(assets: MediaAsset[]) {
    for (const asset of assets) {
      syncDraft(altDrafts, savedAlts, asset.id, asset.alt)
      syncDraft(descriptionDrafts, savedDescriptions, asset.id, asset.description ?? '')
    }
  }
  /** 放弃全部未保存改动，回到已保存值 */
  function discardDrafts() {
    for (const [id, value] of Object.entries(savedAlts)) altDrafts[id] = value
    for (const [id, value] of Object.entries(savedDescriptions)) descriptionDrafts[id] = value
  }
  const drafts = { altDrafts, savedAlts, hasDirtyAlt, descriptionDrafts, savedDescriptions, hasDirtyDescription }
  return { ...drafts, hasDirtyMetadata, syncDrafts, discardDrafts }
}

export type MediaDrafts = ReturnType<typeof createMediaDrafts>

/** 逐项保存替代文本或说明；保存期间草稿再次改动时保留新草稿 */
export function createMediaMetadataSave(ctx: MediaWorkspace, drafts: MediaDrafts) {
  const { api, t, working, error, items } = ctx
  async function saveField(asset: MediaAsset, field: 'alt' | 'description') {
    if (working.value || !ctx.allowAction(asset)) return
    const operation = ctx.guard.ownershipVersion
    const draftMap = field === 'alt' ? drafts.altDrafts : drafts.descriptionDrafts
    const saved = field === 'alt' ? drafts.savedAlts : drafts.savedDescriptions
    const submitted = draftMap[asset.id] ?? ''
    working.value = true
    error.value = ''
    try {
      const result = await api<MediaAsset>(`/admin/media/${asset.id}`, {
        method: 'PATCH',
        body: { [field]: submitted },
      })
      if (!ctx.ownsOperation(operation)) return
      const value = result[field] ?? ''
      const current = items.value.find((item) => item.id === asset.id)
      if (current) current[field] = value
      saved[asset.id] = value
      if (draftMap[asset.id] === submitted) draftMap[asset.id] = value
      ctx.toast.success(
        field === 'alt' ? t('admin-media.mediaMessages.altSaved') : t('admin-media.mediaMessages.descriptionSaved'),
      )
    } catch {
      if (ctx.ownsOperation(operation))
        error.value =
          field === 'alt'
            ? t('admin-media.mediaMessages.altSaveFailed')
            : t('admin-media.mediaMessages.descriptionSaveFailed')
    } finally {
      working.value = false
    }
  }
  const saveAlt = (asset: MediaAsset) => saveField(asset, 'alt')
  const saveDescription = (asset: MediaAsset) => saveField(asset, 'description')
  return { saveAlt, saveDescription }
}
