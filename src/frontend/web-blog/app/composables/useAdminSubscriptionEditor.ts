/** @file useAdminSubscriptionEditor.ts @description 订阅管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type {
  SubscriptionEditable,
  SubscriptionForm,
  SubscriptionPublication,
  ManagedSubscription,
} from '~/features/subscription/types'
import { subscriptionForm, subscriptionBody } from '~/features/subscription/editor'
import { editorRecoveryKey } from '~/utils/editorRecoveryStorage'
import { useSubscriptionEditorRecovery } from '~/features/subscription/useSubscriptionEditorRecovery'

export function useAdminSubscriptionEditor(initialId: number | null, options: { inline?: boolean } = {}) {
  const repo = useSubscriptionRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp(),
    { t } = useI18n()
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(subscriptionForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const saved = ref<ManagedSubscription | null>(null),
    serverVersion = ref<ManagedSubscription | null>(null)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref(''),
    localError = ref(''),
    requiresReload = ref(false)
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const pendingCreate = ref<SubscriptionEditable | null>(null)
  let actor = '',
    requestId = '',
    ownedContext = '',
    generation = 0,
    alive = true

  const ownershipLost = computed(() => {
    const currentActor = auth.currentUser.value?.id
    const authenticated = auth.isLoggedIn.value
    const currentContext = context.value
    return (
      requiresReload.value || (!!actor && (!authenticated || currentActor !== actor || currentContext !== ownedContext))
    )
  })

  const storagePrefix = () => `blog-subscription-editor:${actor}:${initialId ?? 'new'}`
  const storageKey = () => editorRecoveryKey(storagePrefix(), ownedContext)
  const owns = (user: string | undefined, version: number) =>
    alive &&
    generation === version &&
    auth.isLoggedIn.value &&
    auth.currentUser.value?.id === user &&
    ownedContext === context.value

  const recoveryManager = useSubscriptionEditorRecovery({
    getActor: () => actor,
    getOwnedContext: () => ownedContext,
    getRequestId: () => requestId,
    initialId,
    id,
    revision,
    saved,
    serverVersion,
    form,
    baseline,
    dirty,
    pendingCreate,
    ready,
    saving,
    loading,
    requiresReload,
    ownershipLost,
    error,
    notice,
    localError,
    storagePrefix,
    storageKey,
    setRequestId: (val) => {
      requestId = val
    },
    fetchDetail: (targetId) => repo.adminDetail(targetId),
    owns,
  })

  function accept(subscription: ManagedSubscription) {
    saved.value = subscription
    id.value = subscription.id
    revision.value = subscription.revision
    Object.assign(form, subscriptionForm(subscription))
    baseline.value = JSON.stringify(form)
    serverVersion.value = null
  }

  async function load(replace = false) {
    if (requiresReload.value) return
    const version = ++generation
    loading.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error(t('admin-media.subscriptionEditor.loginRequired'))
      const user = auth.currentUser.value!.id
      if (!alive || version !== generation) return
      actor ||= user
      ownedContext ||= context.value
      requestId ||= crypto.randomUUID()
      if (ownedContext !== context.value) throw new Error(t('admin-media.subscriptionEditor.contextChangedLoad'))
      recoveryManager.loadRecoveries()
      if (replace || (!dirty.value && !saved.value)) {
        const subscription = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (subscription) accept(subscription)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation)
        error.value = cause instanceof Error ? cause.message : t('admin-media.subscriptionEditor.loadFailed')
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }

  function change(value: Partial<SubscriptionForm>) {
    if (!ready.value || saving.value || loading.value || ownershipLost.value) return
    Object.assign(form, value)
    error.value = ''
    notice.value = ''
  }

  async function resolvePendingSubmission(user: string, version: number) {
    if (id.value || !pendingCreate.value) return null
    try {
      const known = await repo.submission(requestId)
      if (!owns(user, version)) return null
      if (known.state === 'deleted') throw new Error(t('admin-media.subscriptionEditor.submissionDeleted'))
      return known.item
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
      return null
    }
  }

  function applySaved(subscription: ManagedSubscription, capture: string, recoveringMatches: boolean) {
    saved.value = subscription
    id.value = subscription.id
    revision.value = subscription.revision
    pendingCreate.value = null
    serverVersion.value = null
    baseline.value = JSON.stringify(subscriptionForm(subscription))
    if (JSON.stringify(form) === capture && recoveringMatches) Object.assign(form, subscriptionForm(subscription))
    notice.value = dirty.value
      ? t('admin-media.subscriptionEditor.savedWithChanges')
      : t('admin-media.subscriptionEditor.saved')
    if (!dirty.value) {
      try {
        sessionStorage.removeItem(storageKey())
        recoveryManager.recovery.value = null
      } catch {
        localError.value = t('admin-media.subscriptionEditor.savedDiscardFailed')
      }
    } else recoveryManager.persistLocal()
    void app.runWithContext(() => refreshNuxtData(['subscriptions-feed']))
  }

  async function save(status: SubscriptionPublication) {
    if (!ready.value || saving.value || loading.value || !form.name.trim()) return
    const user = auth.currentUser.value?.id,
      version = generation,
      capture = JSON.stringify(form)
    const recoveringMatches =
      !pendingCreate.value ||
      JSON.stringify({ ...subscriptionForm(form), status: pendingCreate.value.status }) ===
        JSON.stringify(subscriptionForm(pendingCreate.value))
    if (!auth.isLoggedIn.value || !user || user !== actor || ownedContext !== context.value) {
      ready.value = false
      error.value = t('admin-media.subscriptionEditor.contextChanged')
      return
    }
    saving.value = true
    error.value = ''
    notice.value = ''
    let redirect: string | undefined
    try {
      subscriptionBody(form, status)
      let subscription = await resolvePendingSubmission(user, version)
      if (!subscription) {
        const body = !id.value && pendingCreate.value ? pendingCreate.value : subscriptionBody(form, status)
        if (!id.value) pendingCreate.value = body
        recoveryManager.persistLocal()
        subscription = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(user, version)) return
      const wasNew = id.value === null
      applySaved(subscription, capture, recoveringMatches)
      if (wasNew && !dirty.value && !options.inline) redirect = `/admin/subscriptions/${subscription.id}`
    } catch (cause) {
      if (owns(user, version)) await recoveryManager.handleSaveConflict(cause, user, version)
    } finally {
      if (alive && generation === version) saving.value = false
    }
    if (redirect && owns(user, version)) await router.replace(redirect)
  }

  async function reload() {
    if (saving.value || loading.value || ownershipLost.value) return
    const preserved = recoveryManager.persistLocal()
    const msg = preserved
      ? t('admin-media.subscriptionEditor.reloadConfirm')
      : t('admin-media.subscriptionEditor.reloadConfirmUnsaved')
    if ((dirty.value || pendingCreate.value) && !window.confirm(msg)) return
    await load(true)
  }

  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', recoveryManager.handleBeforeUnload)
  })

  onBeforeRouteLeave(recoveryManager.canLeave)

  watch(
    form,
    () => {
      if (ready.value) recoveryManager.persistLocal()
    },
    { deep: true },
  )

  watch(
    [() => auth.currentUser.value?.id, () => auth.isLoggedIn.value, context],
    ([next, authenticated]) => {
      if (actor && (!authenticated || next !== actor || context.value !== ownedContext)) {
        recoveryManager.persistLocal()
        generation++
        ready.value = false
        saving.value = false
        loading.value = false
        error.value = t('admin-media.subscriptionEditor.ownershipChanged')
      }
      if (!next || !authenticated) return
      if (actor && next !== actor) {
        actor = next
        requestId = ''
        ownedContext = context.value
        id.value = initialId
        revision.value = null
        saved.value = null
        serverVersion.value = null
        recoveryManager.clearSession()
        pendingCreate.value = null
        Object.assign(form, subscriptionForm())
        baseline.value = JSON.stringify(form)
      }
      if ((!actor || ownedContext === context.value) && !ready.value && !loading.value) void load()
    },
    { flush: 'sync' },
  )

  onScopeDispose(() => {
    recoveryManager.persistLocal()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', recoveryManager.handleBeforeUnload)
  })

  return {
    form,
    ownershipLost,
    requiresReload,
    load,
    id,
    saved,
    serverVersion,
    recovery: recoveryManager.recovery,
    previousRecoveries: recoveryManager.previousRecoveries,
    ready,
    loading,
    saving,
    error,
    notice,
    localError,
    dirty,
    pendingCreate,
    change,
    save,
    reload,
    restoreRecovery: recoveryManager.restoreRecovery,
    discardRecovery: recoveryManager.discardRecovery,
    persistLocal: recoveryManager.persistLocal,
    canLeave: recoveryManager.canLeave,
    mergeConflict: recoveryManager.mergeConflict,
  }
}
