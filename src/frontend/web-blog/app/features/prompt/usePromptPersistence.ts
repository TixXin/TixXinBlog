/** @file usePromptPersistence.ts @description 提示词编辑器的本地草稿持久化、版本键与跨标签页恢复 */
import type { ComputedRef, Ref } from 'vue'
import { parsePromptRecovery, promptForm } from './editor'
import type { PromptRecovery } from './editor'
import type { ManagedPrompt, PromptForm } from './types'

export interface PromptPersistenceOptions {
  initialId: number | null
  form: PromptForm
  id: Ref<number | null>
  storageId: Ref<number | null>
  revision: Ref<number | null>
  pendingCreate: Ref<PromptForm | null>
  recovery: Ref<PromptRecovery | null>
  serverVersion: Ref<ManagedPrompt | null>
  localError: Ref<string>
  notice: Ref<string>
  error: Ref<string>
  ready: Ref<boolean>
  saving: Ref<boolean>
  dirty: ComputedRef<boolean>
  getMeta: () => { actor: string; ownedContext: string; requestId: string }
  setRequestId: (val: string) => void
  t: (key: string, ...args: unknown[]) => string
}

export function usePromptPersistence(options: PromptPersistenceOptions) {
  const {
    initialId,
    form,
    id,
    storageId,
    revision,
    pendingCreate,
    recovery,
    serverVersion,
    localError,
    notice,
    error,
    ready,
    saving,
    dirty,
    getMeta,
    setRequestId,
    t,
  } = options

  const storageKey = () => {
    const { actor, ownedContext } = getMeta()
    return `blog-prompt-editor:${actor}:${ownedContext}:${storageId.value ?? 'new'}`
  }

  function persist() {
    const { actor, ownedContext, requestId } = getMeta()
    if (!import.meta.client || !actor) return !dirty.value && !pendingCreate.value
    try {
      if (!dirty.value && !pendingCreate.value) {
        // 撤回本次修改后移除过期副本；尚未处理的上次输入仍保留供显式恢复。
        if (recovery.value) sessionStorage.setItem(storageKey(), JSON.stringify(recovery.value))
        else sessionStorage.removeItem(storageKey())
        localError.value = ''
        return true
      }
      const value: PromptRecovery = {
        version: 1,
        context: ownedContext,
        id: id.value,
        revision: revision.value,
        requestId,
        form: promptForm(form),
        pendingCreate: pendingCreate.value,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
      localError.value = ''
      return true
    } catch {
      localError.value = t('misc.prompt.editorState.persistFailed')
      return false
    }
  }

  function moveRecoveryToSavedItem(previousKey: string) {
    // 新建后继续编辑的输入归属真实作品；新键持久化成功之前保留原副本。
    const persisted = persist()
    if (!persisted || previousKey === storageKey()) return
    try {
      sessionStorage.removeItem(previousKey)
    } catch {
      localError.value = t('misc.prompt.editorState.cleanupFailed')
    }
  }

  function readRecovery() {
    try {
      recovery.value = parsePromptRecovery(sessionStorage.getItem(storageKey()))
    } catch {
      localError.value = t('misc.prompt.editorState.recoveryReadFailed')
    }
  }

  function restoreRecovery() {
    const value = recovery.value
    const { ownedContext } = getMeta()
    if (
      !value ||
      !ready.value ||
      saving.value ||
      value.context !== ownedContext ||
      (initialId !== null && value.id !== initialId)
    )
      return
    if (
      dirty.value &&
      JSON.stringify(form) !== JSON.stringify(value.form) &&
      !window.confirm(t('misc.prompt.editorState.restoreConfirm'))
    )
      return
    const previousKey = storageKey()
    Object.assign(form, promptForm(value.form))
    id.value = value.id
    storageId.value = value.id
    revision.value = value.revision
    setRequestId(value.requestId)
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    serverVersion.value = null
    error.value = ''
    notice.value = value.pendingCreate
      ? t('misc.prompt.editorState.restoredPending')
      : t('misc.prompt.editorState.restored')
    moveRecoveryToSavedItem(previousKey)
  }

  function discardRecovery() {
    if (saving.value || !recovery.value) return
    const previous = recovery.value
    recovery.value = null
    // 移除上次副本不能一并丢弃重新打开后写入的当前表单。
    if (!persist()) {
      recovery.value = previous
      localError.value = t('misc.prompt.editorState.discardFailed')
      return
    }
    notice.value =
      dirty.value || pendingCreate.value
        ? t('misc.prompt.editorState.discardedKept')
        : t('misc.prompt.editorState.discarded')
  }

  return {
    storageKey,
    persist,
    moveRecoveryToSavedItem,
    readRecovery,
    restoreRecovery,
    discardRecovery,
  }
}
