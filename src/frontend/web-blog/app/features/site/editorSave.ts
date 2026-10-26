/** @file editorSave.ts @description 站点设置编辑器的保存：冻结请求正文、未确认提交保留、409 读取最新配置与未知结果核查 */
import type { SiteSettingsData } from './settings'
import { mergeSiteSettings, normalizeSiteSettings, sameSiteValues } from './editor'
import { SITE_EDITOR_I18N as S } from './editorLabels'
import type { SiteEditorSession } from './editorSession'

export function createSiteEditorSaver(s: SiteEditorSession, loadHistory: (page?: number) => Promise<void>) {
  const { api, owns, session, clone, t, draft, submission, pending, error } = s
  /** 409 后读取最新配置供合并；读取失败只在原错误后追加提示 */
  async function readConflict(version: number) {
    try {
      const latest = await api<SiteSettingsData>('/admin/site')
      if (owns(version)) s.conflict.value = latest
    } catch {
      if (owns(version)) error.value += t(`${S}.latestFailedSuffix`)
    }
  }
  async function writeFailed(cause: unknown, version: number) {
    const status = (cause as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500 && status !== 408) submission.value = null
    error.value = submission.value ? t(`${S}.submissionUnconfirmed`) : apiErrorMessage(cause, `${S}.saveFailed`, { t })
    if (status === 409) await readConflict(version)
    s.persist()
  }
  async function write(path: string, method: 'PATCH' | 'POST', body: unknown, expected: SiteSettingsData) {
    if (pending.value || submission.value || s.conflict.value || !s.ready.value || !draft.value) return
    if (!owns(session.generation)) return
    const version = session.generation
    const input = clone(draft.value)
    submission.value = { draft: clone(expected), base: JSON.parse(s.baseline.value) as SiteSettingsData }
    s.persist()
    pending.value = true
    error.value = ''
    try {
      const value = await api<SiteSettingsData>(path, { method, body })
      if (!owns(version)) return
      const current = clone(draft.value!)
      s.accept(value)
      // 请求正文已冻结，迟到的成功响应也不能抹掉请求开始后产生的新输入。
      draft.value = mergeSiteSettings(input, current, clone(draft.value!)).merged
      submission.value = null
      s.persist()
      s.toast.success(t(`${S}.saved`))
      await loadHistory(1)
    } catch (cause) {
      if (!owns(version)) return
      await writeFailed(cause, version)
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function save() {
    if (!draft.value) return
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...body } = draft.value
    await write('/admin/site', 'PATCH', body, clone(draft.value))
  }
  return { write, save, checkSubmission: createSubmissionCheck(s) }
}

/** 未知提交结果核查：服务器已是提交内容则确认并合并后续输入，否则转为冲突 */
function createSubmissionCheck(s: SiteEditorSession) {
  const { api, owns, session, clone, t, draft, submission, preserved, error } = s
  function confirmSubmission(latest: SiteSettingsData) {
    const current = clone(draft.value!)
    const sent = clone(submission.value!.draft)
    const prior = clone(submission.value!.base)
    s.accept(latest)
    // 刷新后编辑器仍是服务器资料；原提交副本已生效时无需再提供重复恢复。
    if (preserved.value && sameSiteValues(preserved.value, sent)) {
      preserved.value = null
      s.preservedBase.value = null
    }
    if (!sameSiteValues(current, prior) && !sameSiteValues(current, latest))
      draft.value = mergeSiteSettings(sent, current, clone(draft.value!)).merged
    error.value = t(`${S}.submissionConfirmed`)
  }
  return async function checkSubmission() {
    if (!submission.value || s.pending.value || !s.ready.value || !owns(session.generation)) return
    const version = session.generation
    s.pending.value = true
    try {
      const latest = await api<SiteSettingsData>('/admin/site')
      if (!owns(version)) return
      if (sameSiteValues(submission.value!.draft, latest)) confirmSubmission(latest)
      else {
        s.conflict.value = normalizeSiteSettings(latest)
        error.value = t(`${S}.submissionDiffers`)
      }
      submission.value = null
      s.persist()
    } catch {
      if (owns(version)) error.value = t(`${S}.submissionStillUnknown`)
    } finally {
      if (owns(version)) s.pending.value = false
    }
  }
}
