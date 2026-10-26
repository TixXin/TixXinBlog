/**
 * @file useSiteSettingsEditor.ts
 * @description 站点设置编辑、失败保留、版本冲突与历史恢复；按会话、读取、保存、操作与生命周期组装。
 */
import { createSiteEditorSession } from '~/features/site/editorSession'
import { createSiteEditorLoader } from '~/features/site/editorLoad'
import { createSiteEditorSaver } from '~/features/site/editorSave'
import { createSiteEditorActions } from '~/features/site/editorActions'
import { useSiteEditorLifecycle } from '~/features/site/editorLifecycle'

export function useSiteSettingsEditor() {
  const s = createSiteEditorSession()
  const { load, loadHistory, inspect } = createSiteEditorLoader(s)
  const { write, save, checkSubmission } = createSiteEditorSaver(s, loadHistory)
  const { loadHistorical, restoreHistorical, mergeConflict, recoverPreserved } = createSiteEditorActions(s, write)
  useSiteEditorLifecycle(s, { load, loadHistory })
  return {
    draft: s.draft,
    ready: s.ready,
    conflict: s.conflict,
    historical: s.historical,
    preserved: s.preserved,
    submission: s.submission,
    checkSubmission,
    pending: s.pending,
    error: s.error,
    dirty: s.dirty,
    history: s.history,
    historyPage: s.historyPage,
    historyTotal: s.historyTotal,
    historyPending: s.historyPending,
    historyError: s.historyError,
    load,
    save,
    loadHistory,
    inspect,
    loadHistorical,
    restoreHistorical,
    mergeConflict,
    recoverPreserved,
  }
}
