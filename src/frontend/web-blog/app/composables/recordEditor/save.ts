/** @file save.ts @description 后台记录编辑器的保存：未知提交核查、提交、接受结果与保存期间输入保护、失败分派与冲突读取 */
import { readLatestQuietly, requestStatusCode } from '~/utils/editorState'
import { isPendingCreateMatched, removeRecoverySafe } from '../useAdminRecordEditor.types'
import type { AdminRecordRecovery } from '../useAdminRecordEditor.types'
import type { RecordPersistence, RecordSession } from './session'

/** 提交前后的单步操作：核查原提交、提交表单、接受结果 */
function createRecordSubmission<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(s: RecordSession<TForm, TEntity, TStatus, TRecovery>, p: RecordPersistence<TForm, TEntity, TStatus, TRecovery>) {
  const { options, state, session, t } = s
  const { form, id, revision, pendingCreate } = state
  /** 新建结果未知时先按提交标识核查原提交；原提交不存在（404）时返回 null，归属已变化时返回 'stale' */
  async function findSubmission(user: string, version: number): Promise<TEntity | null | 'stale'> {
    try {
      const known = await options.repo.submission(session.requestId)
      if (!s.owns(user, version)) return 'stale'
      if (known.state === 'deleted') throw new Error(t(options.messages.submissionDeleted))
      return known.item
    } catch (cause) {
      if (requestStatusCode(cause) !== 404) throw cause
      return null
    }
  }
  /** 提交表单；新建时先登记待核查提交并写入恢复副本，重试沿用原提交内容 */
  function submit(status: TStatus) {
    const body =
      !id.value && pendingCreate.value ? pendingCreate.value : ({ ...options.cloneForm(form), status } as TForm)
    if (!id.value) pendingCreate.value = body
    p.persistLocal()
    return options.repo.save(body, session.requestId, id.value ?? undefined, revision.value ?? undefined)
  }
  /** 接受保存结果；保存期间又有输入时保留输入。返回新建成功后要跳转的地址 */
  function applySaved(entity: TEntity, capture: string, recoveringMatches: boolean) {
    const wasNew = id.value === null
    const rawAccepted = options.entityToForm(entity)
    const accepted = options.processAccepted
      ? options.processAccepted(options.cloneForm(rawAccepted), form)
      : rawAccepted
    const shouldSync = JSON.stringify(form) === capture && recoveringMatches
    p.accept(entity, shouldSync ? accepted : form)
    pendingCreate.value = null
    state.notice.value = s.dirty.value ? t(options.messages.savedDirty) : t(options.messages.saved)
    if (!s.dirty.value) {
      if (!removeRecoverySafe(s.storageKey()) && options.messages.recoveryNotRemoved) {
        state.localError.value = t(options.messages.recoveryNotRemoved)
      }
      state.recovery.value = null
    } else p.persistLocal()
    void s.app.runWithContext(() => refreshNuxtData(options.refreshKeys))
    return wasNew && !s.dirty.value ? options.redirectPath(entity) : undefined
  }
  return { findSubmission, submit, applySaved }
}

export function createRecordSave<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(s: RecordSession<TForm, TEntity, TStatus, TRecovery>, p: RecordPersistence<TForm, TEntity, TStatus, TRecovery>) {
  const { options, state, session, t } = s
  const { form, id, pendingCreate, error, notice, saving } = state
  const submission = createRecordSubmission(s, p)
  const canStart = () => state.ready.value && !saving.value && !state.loading.value && options.canSave(form)
  const ownsSession = (user: string | undefined): user is string =>
    !!user && user === session.actor && session.ownedContext === s.context.value
  async function handleFailure(cause: unknown, user: string, version: number) {
    error.value = cause instanceof Error ? cause.message : t(options.messages.saveFailed)
    const statusCode = requestStatusCode(cause)
    if (statusCode === 400) pendingCreate.value = null
    const conflictId = id.value
    if (statusCode === 409 && conflictId)
      await readLatestQuietly(
        () => options.repo.adminDetail(conflictId),
        (latest) => {
          if (s.owns(user, version)) state.serverVersion.value = latest
        },
      )
    if (!id.value && pendingCreate.value) error.value += t(options.messages.pendingHint)
    p.persistLocal()
  }
  async function save(status: TStatus) {
    if (!canStart()) return
    const user = s.auth.currentUser.value?.id,
      version = session.generation,
      capture = JSON.stringify(form)
    const recoveringMatches = isPendingCreateMatched(pendingCreate.value, form, options.cloneForm)
    if (!ownsSession(user)) {
      state.ready.value = false
      error.value = t(options.messages.contextChanged)
      return
    }
    saving.value = true
    error.value = notice.value = ''
    let redirect: string | undefined
    try {
      const known = !id.value && pendingCreate.value ? await submission.findSubmission(user, version) : null
      if (known === 'stale') return
      const entity = known ?? (await submission.submit(status))
      if (!s.owns(user, version)) return
      redirect = submission.applySaved(entity, capture, recoveringMatches)
    } catch (cause) {
      if (s.owns(user, version)) await handleFailure(cause, user, version)
    } finally {
      if (session.alive && session.generation === version) saving.value = false
    }
    if (redirect && s.owns(user, version)) await s.router.replace(redirect)
  }
  return { save }
}
