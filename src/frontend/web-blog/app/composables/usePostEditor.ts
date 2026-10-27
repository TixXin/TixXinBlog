/**
 * @file usePostEditor.ts
 * @description 博主文章编辑状态：加载、真实保存、发布撤回、失败保留与未保存离开提示；按会话、读写、版本取舍与生命周期组装。
 */
import type { AdminPostDraft } from '~/features/post/adminTypes'
import type { PostRecoveryItem } from '~/utils/postRecovery'
import { createPostEditorSession } from '~/features/post/editorSession'
import { loadPost, restoreHistorical, savePost } from '~/features/post/editorSave'
import * as versions from '~/features/post/editorVersions'
import { usePostEditorLifecycle } from '~/features/post/editorLifecycle'

export function usePostEditor(id: string | null) {
  const s = createPostEditorSession(id)
  const save = (status: AdminPostDraft['status'], automatic = false) => savePost(s, status, automatic)
  usePostEditorLifecycle(s, { load: () => loadPost(s), save })
  return {
    draft: s.draft,
    tags: s.tags,
    options: s.options,
    pending: s.pending,
    ready: s.ready,
    error: s.error,
    dirty: s.dirty,
    save,
    conflict: s.conflict,
    localForCompare: s.localForCompare,
    preservedLocal: s.preservedLocal,
    useServerVersion: () => versions.adoptServerVersion(s),
    keepLocalVersion: () => versions.keepLocalVersion(s),
    recoverPreservedLocal: () => versions.recoverPreservedLocal(s),
    recovery: s.recovery,
    automaticSaving: s.automaticSaving,
    serverAutoSave: s.serverAutoSave,
    autoSavePaused: s.autoSavePaused,
    recoverySelection: s.recoverySelection,
    recoveryServer: s.recoveryServer,
    recoveryReviewPending: s.recoveryReviewPending,
    reviewRecovery: (item: PostRecoveryItem) => versions.reviewRecovery(s, item),
    applyRecovery: () => versions.applyRecovery(s),
    skipRecovery: () => versions.skipRecovery(s),
    discardRecovery: (item: PostRecoveryItem) => versions.discardRecovery(s, item),
    continueWithoutRecovery: () => {
      s.autoSavePaused.value = false
    },
    persistLocal: () => versions.persistLocal(s),
    loadHistorical: (source: AdminPostDraft) => versions.loadHistorical(s, source),
    restoreHistorical: (historical: number) => restoreHistorical(s, historical),
    reviewingPublication: s.reviewingPublication,
  }
}
