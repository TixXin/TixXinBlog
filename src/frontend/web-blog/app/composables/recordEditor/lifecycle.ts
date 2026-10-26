/** @file lifecycle.ts @description 后台记录编辑器的输入、重新读取、恢复副本与冲突合并，以及挂载、离开保护和归属变化 */
import { removeRecoverySafe, useEditorLifecycle } from '../useAdminRecordEditor.types'
import type { AdminRecordRecovery } from '../useAdminRecordEditor.types'
import type { RecordPersistence, RecordSession } from './session'

export function createRecordActions<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(
  s: RecordSession<TForm, TEntity, TStatus, TRecovery>,
  p: RecordPersistence<TForm, TEntity, TStatus, TRecovery>,
  load: (replace?: boolean) => Promise<void>,
) {
  const { options, state, session, t } = s
  const { form, id, revision, recovery, error, notice, saving, ready } = state
  const { messages } = options
  function change(value: Partial<TForm>) {
    if (!ready.value) return
    Object.assign(form, value)
    error.value = notice.value = ''
  }
  async function reload() {
    if (saving.value || (s.dirty.value && !window.confirm(t(messages.reloadConfirm)))) return
    p.persistLocal()
    await load(true)
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || !ready.value) return
    if (value.context !== session.ownedContext || (options.initialId !== null && value.id !== options.initialId)) {
      error.value = t(messages.recoveryMismatch)
      return
    }
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    session.requestId = value.requestId
    state.pendingCreate.value = value.pendingCreate
    recovery.value = null
    notice.value = t(messages.restored)
  }
  function discardRecovery() {
    if (!removeRecoverySafe(session.currentRecoveryKey || s.storageKey()))
      state.localError.value = t(messages.discardFailed)
    else recovery.value = null
  }
  function mergeConflict() {
    const latest = state.serverVersion.value
    if (!latest || saving.value || !ready.value || latest.id !== id.value) return
    revision.value = latest.revision
    state.saved.value = latest
    state.serverVersion.value = null
    s.baseline.value = JSON.stringify(options.entityToForm(latest))
    notice.value = t(messages.merged)
    error.value = ''
    p.persistLocal()
  }
  return { change, reload, restoreRecovery, discardRecovery, mergeConflict }
}

/** 挂载后读取；离开与刷新时保护输入；账号或内容库变化时作废会话 */
export function useRecordLifecycle<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(
  s: RecordSession<TForm, TEntity, TStatus, TRecovery>,
  p: RecordPersistence<TForm, TEntity, TStatus, TRecovery>,
  load: () => Promise<void>,
) {
  const { state, session, t, options } = s
  onMounted(() => void load())
  useEditorLifecycle(
    p.persistLocal,
    () => s.dirty.value || state.saving.value || Boolean(state.pendingCreate.value),
    () => state.saving.value,
    () => window.confirm(t(options.messages.leaveConfirm)),
  )
  watch(state.form, p.persistLocal, { deep: true })
  watch(
    () => s.auth.currentUser.value?.id,
    (next) => {
      if (session.actor && next !== session.actor) {
        p.invalidate()
        if (next) {
          p.resetSession(next)
          void load()
        }
      } else if (next && !state.ready.value && !state.loading.value) void load()
    },
  )
  watch(s.context, () => {
    if (session.actor && s.context.value !== session.ownedContext) p.invalidate(t(options.messages.contextSwitched))
  })
  onScopeDispose(() => {
    session.alive = false
    session.generation++
  })
}
