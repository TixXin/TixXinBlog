/** @file editorVersions.ts @description 文章编辑的版本取舍：冲突时保留本地或采用服务器版本、本机恢复副本的比较与载入、历史修订载入为编辑内容 */
import type { AdminPostDraft } from './adminTypes'
import type { PostRecoveryItem } from '~/utils/postRecovery'
import { copyContentRelations } from '~/features/content-relation/editor'
import type { PostEditorSession } from './editorSession'

export function adoptServerVersion(s: PostEditorSession) {
  if (!s.conflict.value) return
  if (!s.recovery.preserve(s.localForCompare.value)) return
  s.preservedLocal.value = structuredClone(toRaw(s.localForCompare.value))
  s.acceptSaved(structuredClone(toRaw(s.conflict.value)))
  s.conflict.value = null
  s.error.value = ''
}

export function keepLocalVersion(s: PostEditorSession) {
  if (!s.conflict.value) return
  // 用户比较后显式采用最新版本号，下一次保存仍受版本校验保护。
  s.draft.value.revision = s.conflict.value.revision
  s.autoSavePaused.value = true
  s.conflict.value = null
  s.error.value = s.t('admin-content.postSave.keptLocal')
}

export function recoverPreservedLocal(s: PostEditorSession) {
  if (!s.preservedLocal.value) return
  const revision = s.draft.value.revision
  s.draft.value = { ...structuredClone(toRaw(s.preservedLocal.value)), revision }
  s.tags.value = s.draft.value.tags.join(', ')
  s.preservedLocal.value = null
  s.autoSavePaused.value = true
}

export async function reviewRecovery(s: PostEditorSession, item: PostRecoveryItem) {
  if (s.pending.value || s.recoveryReviewPending.value) return
  s.recoveryReviewPending.value = true
  try {
    s.recoveryServer.value = s.id
      ? await s.api<AdminPostDraft>(`/admin/posts/${s.id}`)
      : structuredClone(toRaw(s.localForCompare.value))
    s.recoverySelection.value = item
  } catch {
    s.error.value = s.t('admin-content.postSave.recoveryServerFailed')
  } finally {
    s.recoveryReviewPending.value = false
  }
}

export function applyRecovery(s: PostEditorSession) {
  if (!s.recoverySelection.value || !s.recoveryServer.value) return
  if (s.dirty.value && !s.recovery.preserve(s.localForCompare.value)) return
  const current = s.recoveryServer.value
  s.draft.value = {
    ...structuredClone(toRaw(s.recoverySelection.value.draft)),
    id: current.id,
    revision: current.revision,
    status: current.status,
    savedAt: current.savedAt,
  }
  s.tags.value = s.draft.value.tags.join(', ')
  s.session.recoveredSourceKey = s.recoverySelection.value.key
  s.recoverySelection.value = null
  s.recoveryServer.value = null
  s.autoSavePaused.value = true
  s.error.value = s.t('admin-content.postSave.recoveryApplied')
  s.recovery.persist(s.localForCompare.value)
}

export function skipRecovery(s: PostEditorSession) {
  s.recoverySelection.value = null
  s.recoveryServer.value = null
}

export function discardRecovery(s: PostEditorSession, item: PostRecoveryItem) {
  if (!window.confirm(s.t('admin-content.postSave.discardRecoveryConfirm'))) return
  s.recovery.discard(item.key)
}

export function persistLocal(s: PostEditorSession) {
  if (s.ready.value && s.dirty.value) s.recovery.persist(s.localForCompare.value)
}

/** 历史修订的内容字段覆盖当前草稿，保留当前文章身份、修订号与状态 */
function historicalDraft(current: AdminPostDraft, source: AdminPostDraft): AdminPostDraft {
  return {
    id: current.id,
    revision: current.revision,
    savedAt: current.savedAt,
    status: current.status,
    title: source.title,
    slug: source.slug ?? current.slug,
    coverAlt: source.coverAlt ?? current.coverAlt,
    seoTitle: source.seoTitle ?? current.seoTitle,
    seoDescription: source.seoDescription ?? current.seoDescription,
    seoNoindex: source.seoNoindex ?? current.seoNoindex,
    summary: source.summary,
    cover: source.cover,
    category: source.category,
    folder: source.folder,
    contentRaw: source.contentRaw,
    readTimeMinutes: source.readTimeMinutes,
    pinned: source.pinned,
    tags: [...source.tags],
    relatedContent: copyContentRelations(source.relatedContent),
  }
}

export function loadHistorical(s: PostEditorSession, source: AdminPostDraft) {
  if (s.pending.value) return
  if (s.dirty.value && !s.recovery.preserve(s.localForCompare.value)) return
  s.draft.value = historicalDraft(s.draft.value, source)
  s.tags.value = s.draft.value.tags.join(', ')
  s.autoSavePaused.value = true
  s.error.value = s.t('admin-content.postSave.historyLoaded')
  s.recovery.persist(s.localForCompare.value)
}
