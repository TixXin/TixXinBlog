/** @file editorSave.ts @description 页内提示词编辑器的保存：未知提交核查、提交、接受结果与保存期间输入保护、失败与冲突分派 */
import { readLatestQuietly, requestStatusCode } from '~/utils/editorState'
import { promptForm, promptFormError } from './editor'
import type { PromptEditorSession } from './editorSession'
import type { ManagedPrompt, PromptForm, PromptRequestError, PromptStatus } from './types'

/** 新建结果未知时先按提交标识核查原提交；原提交不存在（404）时返回 null，归属已变化时返回 'stale' */
async function findPendingPrompt(s: PromptEditorSession, version: number) {
  let item: ManagedPrompt | null = null
  try {
    item = (await s.repo.submission(s.meta.requestId)).item
  } catch (cause) {
    if (requestStatusCode(cause) !== 404) throw cause
  }
  return s.owns(version) ? item : 'stale'
}

/** 接受保存结果：编号与版本归属已确认作品；保存或核查期间新增的输入始终留在编辑器 */
function applySavedPrompt(s: PromptEditorSession, saved: { item: ManagedPrompt; body: PromptForm; capture: string }) {
  const { item, body, capture } = saved
  const originalMatches = JSON.stringify({ ...promptForm(s.form), status: body.status }) === JSON.stringify(body)
  const previousKey = s.persistence.storageKey()
  s.id.value = item.id
  s.storageId.value = item.id
  s.revision.value = item.revision
  s.markClean(promptForm(item))
  // 网络核查期间或保存期间新增的文字始终留在编辑器，不被较早请求覆盖。
  if (capture === JSON.stringify(s.form) && originalMatches) Object.assign(s.form, promptForm(item))
  s.pendingCreate.value = null
  s.serverVersion.value = null
  s.recovery.value = null
  s.persistence.moveRecoveryToSavedItem(previousKey)
  s.notice.value = s.dirty.value
    ? s.t('misc.prompt.editorState.savedWithPending')
    : item.status === 'published'
      ? s.t('misc.prompt.editorState.published')
      : s.t('misc.prompt.editorState.draftSaved')
}

/** 内容库或身份变化不能按同编号的新内容合并；只有明确的作品版本冲突才读取对照 */
async function handlePromptConflict(
  s: PromptEditorSession,
  conflictKind: PromptRequestError['conflictKind'],
  version: number,
) {
  s.serverVersion.value = null
  if (conflictKind === 'context') {
    s.ready.value = false
    s.requiresReload.value = true
  }
  const conflictId = s.id.value
  if (conflictKind !== 'revision' || !conflictId) return
  await readLatestQuietly(
    () => s.repo.adminDetail(conflictId),
    (latest) => {
      if (s.owns(version)) s.serverVersion.value = latest
    },
  )
}

async function handlePromptSaveFailure(s: PromptEditorSession, cause: unknown, version: number) {
  s.error.value = cause instanceof Error ? cause.message : s.t('misc.prompt.editorState.saveFailed')
  const { statusCode, conflictKind } = cause as PromptRequestError
  if (statusCode === 400) s.pendingCreate.value = null
  if (statusCode === 409) await handlePromptConflict(s, conflictKind, version)
  if (!s.id.value && s.pendingCreate.value) s.error.value += ' ' + s.t('misc.prompt.editorState.retryWillVerify')
  s.persistence.persist()
}

export function createPromptSave(s: PromptEditorSession, onSaved: (item: ManagedPrompt) => void) {
  const { form, meta, t } = s
  /** 校验表单与归属，可以提交时返回当前代次 */
  function prepare() {
    if (!s.ready.value || s.saving.value || s.loading.value) return null
    const validation = promptFormError(form, t)
    if (validation) {
      s.error.value = validation
      return null
    }
    if (s.owns(meta.generation)) return meta.generation
    s.error.value = t('misc.prompt.editorState.contextChanged')
    return null
  }
  /** 提交表单；新建时先登记待核查提交并写入恢复副本 */
  function submit(body: PromptForm) {
    if (!s.id.value) {
      s.pendingCreate.value = body
      s.persistence.persist()
    }
    return s.repo.save(body, meta.requestId, s.id.value ?? undefined, s.revision.value ?? undefined)
  }
  async function save(status: PromptStatus) {
    const version = prepare()
    if (version === null) return
    const capture = JSON.stringify(form)
    s.saving.value = true
    s.error.value = ''
    s.notice.value = ''
    try {
      const known = !s.id.value && s.pendingCreate.value ? await findPendingPrompt(s, version) : null
      if (known === 'stale') return
      const body = !s.id.value && s.pendingCreate.value ? s.pendingCreate.value : { ...promptForm(form), status }
      const item = known ?? (await submit(body))
      if (!s.owns(version)) return
      applySavedPrompt(s, { item, body, capture })
      onSaved(item)
    } catch (cause) {
      if (s.owns(version)) await handlePromptSaveFailure(s, cause, version)
    } finally {
      if (meta.alive && meta.generation === version) s.saving.value = false
    }
  }
  return { save }
}
