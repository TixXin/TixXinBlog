/** @file editorActions.ts @description 站点设置编辑器的操作：载入或恢复历史修订、合并冲突与找回保留的输入 */
import type { SiteSettingsData } from './settings'
import { mergeSiteSettings } from './editor'
import { SITE_EDITOR_I18N as S, siteConflictLabels } from './editorLabels'
import type { SiteEditorSession } from './editorSession'

type Write = (path: string, method: 'PATCH' | 'POST', body: unknown, expected: SiteSettingsData) => Promise<void>

export function createSiteEditorActions(s: SiteEditorSession, write: Write) {
  const { owns, session, clone, draft, historical, preserved, preservedBase, pending, submission } = s
  /** 用历史修订覆盖草稿前，先把未保存的输入留作可找回副本 */
  function keepDirtyDraft() {
    if (s.dirty.value) {
      preserved.value = clone(draft.value!)
      preservedBase.value = JSON.parse(s.baseline.value) as SiteSettingsData
    }
  }
  function loadHistorical() {
    if (!historical.value || !draft.value || pending.value || submission.value || !owns(session.generation)) return
    keepDirtyDraft()
    draft.value = { ...clone(historical.value), revision: draft.value.revision, updatedAt: draft.value.updatedAt }
    historical.value = null
  }
  async function restoreHistorical() {
    if (!historical.value || !draft.value || pending.value || submission.value || !owns(session.generation)) return
    if (!window.confirm(s.t(`${S}.restoreConfirm`, { revision: historical.value.revision }))) return
    keepDirtyDraft()
    await write(
      `/admin/site/revisions/${historical.value.revision}/restore`,
      'POST',
      {
        revision: draft.value.revision,
      },
      { ...clone(historical.value), revision: draft.value.revision },
    )
  }
  return { loadHistorical, restoreHistorical, ...createSiteMergeActions(s) }
}

function createSiteMergeActions(s: SiteEditorSession) {
  const { owns, session, clone, t, draft, conflict, preserved, preservedBase, pending, submission } = s
  function mergeConflict() {
    if (!conflict.value || !draft.value || pending.value || submission.value || !owns(session.generation)) return
    const result = mergeSiteSettings(
      JSON.parse(s.baseline.value) as SiteSettingsData,
      clone(draft.value),
      clone(conflict.value),
    )
    if (
      result.conflicts.length &&
      !window.confirm(t(`${S}.mergeConfirm`, { fields: siteConflictLabels(result.conflicts, t) }))
    )
      return
    s.baseline.value = JSON.stringify(conflict.value)
    draft.value = result.merged
    conflict.value = null
    s.error.value = t(`${S}.merged`)
    s.persist()
  }
  function recoverPreserved() {
    if (!preserved.value || !preservedBase.value || !draft.value || pending.value || submission.value) return
    if (!s.ready.value || !owns(session.generation)) return
    const current = clone(draft.value)
    const result = mergeSiteSettings(clone(preservedBase.value), clone(preserved.value), current)
    if (
      result.conflicts.length &&
      !window.confirm(t(`${S}.recoverConfirm`, { fields: siteConflictLabels(result.conflicts, t) }))
    )
      return
    draft.value = result.merged
    preserved.value = current
    preservedBase.value = JSON.parse(s.baseline.value) as SiteSettingsData
    s.persist()
  }
  return { mergeConflict, recoverPreserved }
}
