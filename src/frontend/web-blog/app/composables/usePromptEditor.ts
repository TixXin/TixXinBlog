/** @file usePromptEditor.ts @description 页内提示词编辑：幂等核查、版本冲突、账号隔离和标签页输入恢复 */
import { createPromptActions, usePromptEditorLifecycle } from '~/features/prompt/editorLifecycle'
import { createPromptSave } from '~/features/prompt/editorSave'
import { createPromptEditorSession, createPromptLoader } from '~/features/prompt/editorSession'
import type { ManagedPrompt } from '~/features/prompt/types'

export function usePromptEditor(initialId: number | null, onSaved: (item: ManagedPrompt) => void) {
  // 会话与读取、保存、合并与生命周期分别在 features/prompt 下实现，这里只负责组装。
  const session = createPromptEditorSession(initialId)
  const { load } = createPromptLoader(session)
  const { save } = createPromptSave(session, onSaved)
  const { merge, canClose } = createPromptActions(session)
  usePromptEditorLifecycle(session, load, canClose)
  const { form, id, ready, loading, saving, error, notice, localError, recovery, serverVersion } = session
  const { requiresReload, ownershipLost, dirty, pendingCreate, persistence } = session
  return {
    form,
    id,
    ready,
    loading,
    saving,
    error,
    notice,
    localError,
    recovery,
    serverVersion,
    requiresReload,
    ownershipLost,
    dirty,
    pendingCreate,
    load,
    save,
    restoreRecovery: persistence.restoreRecovery,
    discardRecovery: persistence.discardRecovery,
    merge,
    persist: persistence.persist,
    canClose,
  }
}
