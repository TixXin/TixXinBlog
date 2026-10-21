/**
 * @file useSubscriptionEditorRecovery.ts
 * @description 订阅编辑器本地恢复、版本冲突解决与草稿存储管理
 * @author TixXin
 * @since 2026-04-20
 */

import type { ManagedSubscription, SubscriptionEditable, SubscriptionForm } from '~/features/subscription/types'
import { subscriptionForm, parseSubscriptionRecovery, type SubscriptionRecovery } from '~/features/subscription/editor'
import { readEditorRecoveries, type EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
import { subscriptionErrorMessage } from '~/features/subscription/labels'

export interface SubscriptionEditorRecoveryContext {
  getActor: () => string
  getOwnedContext: () => string
  getRequestId: () => string
  initialId: number | null
  id: Ref<number | null>
  revision: Ref<number | null>
  saved: Ref<ManagedSubscription | null>
  serverVersion: Ref<ManagedSubscription | null>
  form: SubscriptionForm
  baseline: Ref<string>
  dirty: ComputedRef<boolean>
  pendingCreate: Ref<SubscriptionEditable | null>
  ready: Ref<boolean>
  saving: Ref<boolean>
  loading: Ref<boolean>
  requiresReload: Ref<boolean>
  ownershipLost: ComputedRef<boolean>
  error: Ref<string>
  notice: Ref<string>
  localError: Ref<string>
  storagePrefix: () => string
  storageKey: () => string
  setRequestId: (val: string) => void
  fetchDetail: (id: number) => Promise<ManagedSubscription>
  owns: (user: string | undefined, version: number) => boolean
}

export function useSubscriptionEditorRecovery(ctx: SubscriptionEditorRecoveryContext) {
  const { t } = useI18n()

  const recovery = ref<SubscriptionRecovery | null>(null)
  const previousRecoveries = ref<EditorRecoveryCopy<SubscriptionRecovery>[]>([])
  let currentRecoveryKey = ''

  function loadRecoveries() {
    try {
      const copies = readEditorRecoveries(
        sessionStorage,
        ctx.storagePrefix(),
        ctx.getOwnedContext(),
        parseSubscriptionRecovery,
      )
      recovery.value = copies.current?.value ?? null
      currentRecoveryKey = copies.current?.key ?? ctx.storageKey()
      previousRecoveries.value = copies.previous
      if (copies.migrationIssue) ctx.localError.value = t('admin-media.subscriptionEditor.migrationPending')
    } catch {
      ctx.localError.value = t('admin-media.subscriptionEditor.recoveryReadFailed')
    }
  }

  function persistLocal(): boolean {
    if (!import.meta.client || !ctx.getActor()) return !ctx.dirty.value && !ctx.pendingCreate.value
    try {
      if (!ctx.dirty.value && !ctx.pendingCreate.value) {
        if (!ctx.ready.value && !recovery.value) return true
        if (recovery.value) sessionStorage.setItem(ctx.storageKey(), JSON.stringify(recovery.value))
        else sessionStorage.removeItem(ctx.storageKey())
        ctx.localError.value = ''
        return true
      }
      const value: SubscriptionRecovery = {
        version: 1,
        context: ctx.getOwnedContext(),
        id: ctx.id.value,
        revision: ctx.revision.value,
        requestId: ctx.getRequestId(),
        form: subscriptionForm(ctx.form),
        pendingCreate: ctx.pendingCreate.value,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(ctx.storageKey(), JSON.stringify(value))
      ctx.localError.value = ''
      return true
    } catch {
      ctx.localError.value = t('admin-media.subscriptionEditor.localSaveFailed')
      return false
    }
  }

  function restoreRecovery() {
    const value = recovery.value
    if (!value || ctx.saving.value || ctx.loading.value || !ctx.ready.value || ctx.ownershipLost.value) return
    if (value.context !== ctx.getOwnedContext() || (ctx.initialId !== null && value.id !== ctx.initialId)) {
      ctx.error.value = t('admin-media.subscriptionEditor.recoveryMismatch')
      return
    }
    if (
      ctx.dirty.value &&
      JSON.stringify(ctx.form) !== JSON.stringify(value.form) &&
      !window.confirm(t('admin-media.subscriptionEditor.restoreConfirm'))
    )
      return
    Object.assign(ctx.form, value.form)
    ctx.id.value = value.id
    ctx.revision.value = value.revision
    ctx.setRequestId(value.requestId)
    ctx.pendingCreate.value = value.pendingCreate
    recovery.value = null
    ctx.serverVersion.value = null
    ctx.notice.value = t('admin-media.subscriptionEditor.restored')
    persistLocal()
  }

  function discardRecovery() {
    if (!recovery.value || ctx.saving.value || ctx.loading.value || ctx.ownershipLost.value) return
    const previous = recovery.value
    recovery.value = null
    if (!persistLocal()) {
      recovery.value = previous
      ctx.localError.value = t('admin-media.subscriptionEditor.discardFailed')
      return
    }
    if (currentRecoveryKey && currentRecoveryKey !== ctx.storageKey()) {
      try {
        sessionStorage.removeItem(currentRecoveryKey)
      } catch {
        ctx.localError.value = t('admin-media.subscriptionEditor.discardFailedKept')
      }
    }
    ctx.notice.value =
      ctx.dirty.value || ctx.pendingCreate.value
        ? t('admin-media.subscriptionEditor.discardedKept')
        : t('admin-media.subscriptionEditor.discarded')
  }

  function mergeConflict() {
    const latest = ctx.serverVersion.value
    if (
      !latest ||
      ctx.saving.value ||
      ctx.loading.value ||
      !ctx.ready.value ||
      ctx.ownershipLost.value ||
      latest.id !== ctx.id.value
    )
      return
    ctx.revision.value = latest.revision
    ctx.saved.value = latest
    ctx.baseline.value = JSON.stringify(subscriptionForm(latest))
    ctx.serverVersion.value = null
    ctx.notice.value = t('admin-media.subscriptionEditor.merged')
    ctx.error.value = ''
    persistLocal()
  }

  async function handleSaveConflict(cause: unknown, user: string, version: number) {
    ctx.error.value = subscriptionErrorMessage(cause, t) ?? t('admin-media.subscriptionEditor.saveFailed')
    const { statusCode, conflictKind } = cause as { statusCode?: number; conflictKind?: string }
    if (statusCode === 400) ctx.pendingCreate.value = null
    if (statusCode === 409) ctx.serverVersion.value = null
    if (statusCode === 409 && conflictKind === 'context') {
      ctx.ready.value = false
      ctx.requiresReload.value = true
    }
    if (statusCode === 409 && conflictKind === 'revision' && ctx.id.value) {
      try {
        const latest = await ctx.fetchDetail(ctx.id.value)
        if (ctx.owns(user, version)) ctx.serverVersion.value = latest
      } catch {
        /* 保留原错误和输入。 */
      }
    }
    if (!ctx.id.value && ctx.pendingCreate.value)
      ctx.error.value += t('admin-media.subscriptionEditor.pendingCreateSuffix')
    persistLocal()
  }

  function canLeave(): boolean {
    if (ctx.saving.value || ctx.loading.value) return false
    if (!ctx.dirty.value && !ctx.pendingCreate.value) return true
    const preserved = persistLocal()
    return window.confirm(
      preserved
        ? t('admin-media.subscriptionEditor.leaveConfirm')
        : t('admin-media.subscriptionEditor.leaveConfirmUnsaved'),
    )
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (ctx.dirty.value || ctx.saving.value || ctx.pendingCreate.value) {
      persistLocal()
      event.preventDefault()
      event.returnValue = ''
    }
  }

  function clearSession() {
    recovery.value = null
    previousRecoveries.value = []
    currentRecoveryKey = ''
  }

  return {
    recovery,
    previousRecoveries,
    loadRecoveries,
    persistLocal,
    restoreRecovery,
    discardRecovery,
    mergeConflict,
    handleSaveConflict,
    canLeave,
    handleBeforeUnload,
    clearSession,
  }
}
