/** @file editorSession.ts @description 动态编辑器的会话状态、本标签页恢复副本与读取：账号归属、请求代次和服务器结果接受 */
import { createDirtyTracker } from '~/utils/editorState'
import { momentForm, parseMomentRecovery } from './editor'
import type { MomentRecovery } from './editor'
import type { ManagedMoment, MomentEditable } from './types'

export function createMomentEditorSession(initialId: string | null) {
  const repo = useMomentRepository(),
    auth = useCurrentUser()
  const { t } = useI18n()
  const form = reactive(momentForm())
  const id = ref(initialId),
    revision = ref<number | null>(null),
    saved = ref<ManagedMoment | null>(null),
    serverVersion = ref<ManagedMoment | null>(null)
  const { dirty, markClean } = createDirtyTracker(form)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false)
  const error = ref(''),
    notice = ref(''),
    localError = ref(''),
    recovery = ref<MomentRecovery | null>(null)
  /** 会话归属与请求代次：换账号或卸载后，旧请求的结果一律丢弃 */
  const session = { actor: '', requestId: '', version: 0, alive: true }
  const key = () => `blog-moment-editor:${session.actor}:${initialId ?? 'new'}`
  function persistLocal() {
    if (!import.meta.client || !session.actor || !dirty.value) return
    try {
      const value: MomentRecovery = {
        version: 1,
        id: id.value,
        revision: revision.value,
        requestId: session.requestId,
        form: JSON.parse(JSON.stringify(form)) as MomentEditable,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(key(), JSON.stringify(value))
      localError.value = ''
    } catch {
      localError.value = t('admin-content.momentEditor.recoverySaveFailed')
    }
  }
  const state = { form, id, revision, saved, serverVersion, dirty, ready, loading, saving, error, notice, localError }
  return { ...state, recovery, initialId, repo, auth, t, markClean, session, key, persistLocal }
}

export type MomentEditorSession = ReturnType<typeof createMomentEditorSession>

/** 读取：恢复登录，换账号时先保存旧输入副本并清空表单，再读取详情与恢复副本 */
export function createMomentLoader(s: MomentEditorSession, onAccepted: (note: ManagedMoment) => void) {
  const { form, auth, session, t } = s
  function accept(note: ManagedMoment) {
    s.saved.value = note
    s.id.value = note.id
    s.revision.value = note.revision
    Object.assign(form, momentForm(note))
    s.markClean()
    onAccepted(note)
  }
  function readRecovery() {
    try {
      s.recovery.value = parseMomentRecovery(sessionStorage.getItem(s.key()))
    } catch {
      s.localError.value = t('admin-content.momentEditor.recoveryReadFailed')
    }
  }
  async function load() {
    const current = ++session.version
    s.loading.value = true
    s.error.value = ''
    const isCurrent = () => current === session.version && session.alive
    try {
      if (!(await auth.restore())) throw new Error(t('admin-content.momentEditor.loginFirst'))
      const user = auth.currentUser.value!.id
      if (session.actor && session.actor !== user) {
        s.persistLocal()
        Object.assign(form, momentForm())
        s.markClean()
      }
      session.actor = user
      session.requestId ||= crypto.randomUUID()
      const note = s.id.value ? await s.repo.adminDetail(s.id.value) : null
      if (!isCurrent() || auth.currentUser.value?.id !== user) return
      if (note) accept(note)
      s.ready.value = true
      readRecovery()
    } catch (cause) {
      if (isCurrent())
        s.error.value = cause instanceof Error ? cause.message : t('admin-content.momentEditor.loadFailed')
    } finally {
      if (isCurrent()) s.loading.value = false
    }
  }
  return { load }
}
