/** @file editorLoad.ts @description 站点设置编辑器的读取：登录恢复、资料与恢复副本读取、修订历史与单个修订查看 */
import type { SiteSettingsData } from './settings'
import { emptyAbout } from '../about/settings'
import { parseSiteSettingsRecovery, sameSiteValues } from './editor'
import { SITE_EDITOR_I18N as S } from './editorLabels'
import type { SiteEditorSession, SiteRevisionItem } from './editorSession'

export function createSiteEditorLoader(s: SiteEditorSession) {
  const { api, auth, session, owns, t } = s
  function readRecovery() {
    try {
      const raw = sessionStorage.getItem(s.recoveryKey())
      if (!raw || !s.draft.value) return
      const value = parseSiteSettingsRecovery(raw)
      if (!value) {
        session.unreadableRecovery = true
        s.error.value = t(`${S}.recoveryInvalid`)
        return
      }
      // 保留原始基线；用户载入时再展示同字段竞争，不能预先静默覆盖最新配置。
      const copy = !sameSiteValues(value.draft, value.baseline)
        ? { draft: value.draft, base: value.baseline }
        : value.preserved
      s.preserved.value = copy?.draft ?? null
      s.preservedBase.value = copy?.base ?? null
      s.submission.value = value.submission
      if (s.submission.value) s.error.value = t(`${S}.submissionPendingOnLoad`)
    } catch {
      s.error.value = t(`${S}.recoveryUnreadable`)
    }
  }
  async function load() {
    if (!session.alive || s.pending.value) return
    s.persist()
    const version = ++session.generation
    s.ready.value = false
    s.historyPending.value = false
    s.pending.value = true
    s.error.value = ''
    session.unreadableRecovery = false
    try {
      if (!(await auth.restore())) throw new Error('请先登录')
      if (!session.alive || version !== session.generation) return
      session.actor = auth.currentUser.value!.id
      session.ownedContext = s.context.value
      const value = await api<SiteSettingsData>('/admin/site')
      if (!owns(version)) return
      s.accept(value)
      readRecovery()
      s.ready.value = true
    } catch {
      if (session.alive && version === session.generation) s.error.value = t(`${S}.loadFailed`)
    } finally {
      if (session.alive && version === session.generation) s.pending.value = false
    }
  }
  return { load, ...createSiteHistoryLoader(s) }
}

/** 修订历史分页与单个修订：与资料读取共用请求代次，互斥于历史请求进行中 */
function createSiteHistoryLoader(s: SiteEditorSession) {
  const { api, session, owns, t, historyPending, historyError } = s
  async function loadHistory(page = s.historyPage.value) {
    if (historyPending.value || !s.ready.value || !owns(session.generation)) return
    const version = session.generation
    historyPending.value = true
    historyError.value = ''
    try {
      const result = await api<{ items: SiteRevisionItem[]; total: number }>('/admin/site/revisions', {
        query: { page },
      })
      if (!owns(version)) return
      s.history.value = result.items
      s.historyTotal.value = result.total
      s.historyPage.value = page
    } catch {
      if (owns(version)) historyError.value = t(`${S}.historyFailed`)
    } finally {
      if (owns(version)) historyPending.value = false
    }
  }
  async function inspect(revision: number) {
    if (historyPending.value || !s.ready.value || !owns(session.generation)) return
    const version = session.generation
    historyPending.value = true
    historyError.value = ''
    try {
      const value = await api<SiteSettingsData>(`/admin/site/revisions/${revision}`)
      if (owns(version)) s.historical.value = { ...value, about: value.about ?? emptyAbout() }
    } catch {
      if (owns(version)) historyError.value = t(`${S}.revisionFailed`)
    } finally {
      if (owns(version)) historyPending.value = false
    }
  }
  return { loadHistory, inspect }
}
