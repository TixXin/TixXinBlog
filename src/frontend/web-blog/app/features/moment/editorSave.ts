/** @file editorSave.ts @description 动态编辑器的保存：提交、接受结果与保存期间输入保护、冲突时核查原提交或读取最新版本 */
import { readLatestQuietly, requestStatusCode } from '~/utils/editorState'
import { momentForm } from './editor'
import type { ManagedMoment, MomentEditable, MomentStatus } from './types'
import type { MomentEditorSession } from './editorSession'

const savedNoticeKeys: Record<MomentStatus, string> = {
  published: 'admin-content.momentEditor.published',
  archived: 'admin-content.momentEditor.archived',
  draft: 'admin-content.momentEditor.draftSaved',
}

/** 保存发起时的账号仍是当前账号，且编辑器未卸载 */
const ownsMoment = (s: MomentEditorSession, user: string | undefined) =>
  s.session.alive && s.auth.currentUser.value?.id === user

interface SavedMomentEffects {
  forget: (id: string) => void
  refresh: () => void
}

/** 接受保存结果；保存期间又有输入时保留输入。返回新建成功后要跳转的地址 */
function applySavedMoment(
  s: MomentEditorSession,
  effects: SavedMomentEffects,
  saved: { note: ManagedMoment; capture: string; status: MomentStatus },
) {
  const { note, capture, status } = saved
  const wasNew = !s.id.value
  s.id.value = note.id
  s.revision.value = note.revision
  s.saved.value = note
  s.serverVersion.value = null
  const value = momentForm(note)
  s.markClean(value)
  if (JSON.stringify(s.form) === capture) Object.assign(s.form, value)
  s.notice.value = s.t(savedNoticeKeys[status])
  effects.forget(note.id)
  effects.refresh()
  try {
    if (!s.dirty.value) sessionStorage.removeItem(s.key())
    else s.persistLocal()
  } catch {
    s.localError.value = s.t('admin-content.momentEditor.recoveryCleanupFailed')
  }
  s.recovery.value = null
  return wasNew && !s.dirty.value ? `/admin/moments/${encodeURIComponent(note.id)}` : null
}

/** 冲突时读取最新版本；新建的提交已到达服务器时改为编辑它。账号已变化时返回 false */
async function readMomentConflict(s: MomentEditorSession, user: string | undefined) {
  let stale = false
  await readLatestQuietly(
    () => (s.id.value ? s.repo.adminDetail(s.id.value) : s.repo.submission(s.session.requestId)),
    (latest) => {
      stale = !ownsMoment(s, user)
      if (stale) return
      s.serverVersion.value = latest
      if (s.id.value) return
      s.id.value = latest.id
      s.revision.value = latest.revision
      s.saved.value = latest
      s.error.value = s.t('admin-content.momentEditor.submissionFound')
    },
  )
  return !stale
}

export function createMomentSave(s: MomentEditorSession) {
  const app = useNuxtApp(),
    router = useRouter(),
    store = useMomentStore()
  const { form, session, t } = s
  const effects: SavedMomentEffects = {
    forget: (id) => store.forget(id),
    refresh: () => void app.runWithContext(() => refreshNuxtData('moment-overview')),
  }
  const canSave = () => !s.saving.value && !s.loading.value && s.ready.value && !!form.content.trim()
  async function save(status: MomentStatus) {
    if (!canSave()) return
    s.saving.value = true
    s.error.value = ''
    s.notice.value = ''
    const capture = JSON.stringify(form),
      user = s.auth.currentUser.value?.id
    const body = { ...(JSON.parse(capture) as MomentEditable), status }
    s.persistLocal()
    let redirect: string | null = null
    try {
      const note = await s.repo.save(body, session.requestId, s.id.value ?? undefined, s.revision.value ?? undefined)
      if (!ownsMoment(s, user)) return
      redirect = applySavedMoment(s, effects, { note, capture, status })
    } catch (cause) {
      if (!ownsMoment(s, user)) return
      s.error.value = cause instanceof Error ? cause.message : t('admin-content.momentEditor.saveFailed')
      if (requestStatusCode(cause) === 409 && !(await readMomentConflict(s, user))) return
      s.persistLocal()
    } finally {
      if (session.alive) s.saving.value = false
    }
    if (redirect) await router.replace(redirect)
  }
  return { save }
}
