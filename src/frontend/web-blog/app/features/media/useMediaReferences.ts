/** @file useMediaReferences.ts @description 媒体引用面板：按资源或批量结果查看引用、翻页、关闭与过期请求丢弃 */
import type { MediaReferences } from './types'
import type { MediaWorkspace } from './useMediaWorkspace'

export function createMediaReferences(ctx: MediaWorkspace) {
  const { items, batchResults, working, t } = ctx
  const references = ref<MediaReferences | null>(null)
  const referenceId = ref('')
  const referenceLoading = ref(false)
  const referenceError = ref('')
  let referenceVersion = 0
  const referenceName = computed(
    () =>
      items.value.find((asset) => asset.id === referenceId.value)?.name ??
      batchResults.value.find((result) => result.id === referenceId.value)?.name ??
      referenceId.value,
  )
  function closeReferences() {
    referenceVersion++
    references.value = null
    referenceId.value = ''
    referenceLoading.value = false
    referenceError.value = ''
  }
  /** 只查看当前列表或本次批量结果中的资源 */
  const isKnown = (id: string) =>
    items.value.some((asset) => asset.id === id) || batchResults.value.some((result) => result.id === id)
  async function showReferences(id: string, currentPage = 1) {
    if (working.value || !ctx.allowAction() || !Number.isSafeInteger(currentPage) || currentPage < 1 || !isKnown(id))
      return
    const operation = ctx.guard.ownershipVersion
    const version = ++referenceVersion
    referenceId.value = id
    references.value = null
    referenceError.value = ''
    referenceLoading.value = true
    try {
      const result = await ctx.api<MediaReferences>(`/admin/media/${id}/references`, { query: { page: currentPage } })
      if (ctx.ownsOperation(operation) && version === referenceVersion) references.value = result
    } catch {
      if (ctx.ownsOperation(operation) && version === referenceVersion)
        referenceError.value = t('admin-media.mediaMessages.referencesFailed')
    } finally {
      if (version === referenceVersion) referenceLoading.value = false
    }
  }
  return { references, referenceId, referenceName, referenceLoading, referenceError, closeReferences, showReferences }
}

export type MediaReferencePanel = ReturnType<typeof createMediaReferences>
