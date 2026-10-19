/** @file useAdminSubscriptionEditor.ts @description 订阅管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type {
  SubscriptionEditable,
  SubscriptionForm,
  SubscriptionPublication,
  ManagedSubscription,
} from '~/features/subscription/types'
import { subscriptionForm, subscriptionBody, parseSubscriptionRecovery } from '~/features/subscription/editor'
import type { SubscriptionRecovery } from '~/features/subscription/editor'
import { editorRecoveryKey, readEditorRecoveries } from '~/utils/editorRecoveryStorage'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
import { subscriptionErrorMessage } from '~/features/subscription/labels'
export function useAdminSubscriptionEditor(initialId: number | null, options: { inline?: boolean } = {}) {
  const repo = useSubscriptionRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp(),
    // 在 setup 内取翻译函数：失败处理发生在 await 之后仍可使用
    { t } = useI18n()
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(subscriptionForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const saved = ref<ManagedSubscription | null>(null),
    serverVersion = ref<ManagedSubscription | null>(null),
    recovery = ref<SubscriptionRecovery | null>(null)
  const previousRecoveries = ref<EditorRecoveryCopy<SubscriptionRecovery>[]>([])
  let currentRecoveryKey = ''
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
  // 可见性直接依赖当前认证与内容代次，不能等待异步请求或 watcher 才隐藏私密输入。
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
  function persistLocal() {
    if (!import.meta.client || !actor) return !dirty.value && !pendingCreate.value
    try {
      if (!dirty.value && !pendingCreate.value) {
        if (!ready.value && !recovery.value) return true
        if (recovery.value) sessionStorage.setItem(storageKey(), JSON.stringify(recovery.value))
        else sessionStorage.removeItem(storageKey())
        localError.value = ''
        return true
      }
      const value: SubscriptionRecovery = {
        version: 1,
        context: ownedContext,
        id: id.value,
        revision: revision.value,
        requestId,
        form: subscriptionForm(form),
        pendingCreate: pendingCreate.value,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
      localError.value = ''
      return true
    } catch {
      localError.value = t('admin-media.subscriptionEditor.localSaveFailed')
      return false
    }
  }
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
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      try {
        const copies = readEditorRecoveries(sessionStorage, storagePrefix(), ownedContext, parseSubscriptionRecovery)
        recovery.value = copies.current?.value ?? null
        currentRecoveryKey = copies.current?.key ?? storageKey()
        previousRecoveries.value = copies.previous
        if (copies.migrationIssue) localError.value = t('admin-media.subscriptionEditor.migrationPending')
      } catch {
        localError.value = t('admin-media.subscriptionEditor.recoveryReadFailed')
      }
      if (replace || (!dirty.value && !saved.value)) {
        const subscription = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (subscription) accept(subscription)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation)
        error.value = subscriptionErrorMessage(cause, t) ?? t('admin-media.subscriptionEditor.loadFailed')
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
      let subscription: ManagedSubscription | null = null
      if (!id.value && pendingCreate.value) {
        try {
          const known = await repo.submission(requestId)
          if (!owns(user, version)) return
          if (known.state === 'deleted') throw new Error(t('admin-media.subscriptionEditor.submissionDeleted'))
          subscription = known.item
        } catch (cause) {
          if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
        }
      }
      if (!subscription) {
        const body = !id.value && pendingCreate.value ? pendingCreate.value : subscriptionBody(form, status)
        if (!id.value) pendingCreate.value = body
        persistLocal()
        subscription = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(user, version)) return
      const wasNew = id.value === null
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
          recovery.value = null
        } catch {
          localError.value = t('admin-media.subscriptionEditor.savedDiscardFailed')
        }
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(['subscriptions-feed']))
      if (wasNew && !dirty.value && !options.inline) redirect = `/admin/subscriptions/${subscription.id}`
    } catch (cause) {
      if (!owns(user, version)) return
      error.value = subscriptionErrorMessage(cause, t) ?? t('admin-media.subscriptionEditor.saveFailed')
      const { statusCode, conflictKind } = cause as { statusCode?: number; conflictKind?: string }
      if (statusCode === 400) pendingCreate.value = null
      if (statusCode === 409) serverVersion.value = null
      if (statusCode === 409 && conflictKind === 'context') {
        ready.value = false
        requiresReload.value = true
      }
      if (statusCode === 409 && conflictKind === 'revision' && id.value) {
        try {
          const latest = await repo.adminDetail(id.value)
          if (owns(user, version)) serverVersion.value = latest
        } catch {
          /* 保留原错误和输入。 */
        }
      }
      if (!id.value && pendingCreate.value) error.value += t('admin-media.subscriptionEditor.pendingCreateSuffix')
      persistLocal()
    } finally {
      if (alive && generation === version) saving.value = false
    }
    if (redirect && owns(user, version)) await router.replace(redirect)
  }
  async function reload() {
    if (saving.value || loading.value || ownershipLost.value) return
    const preserved = persistLocal()
    if (
      (dirty.value || pendingCreate.value) &&
      !window.confirm(
        preserved
          ? t('admin-media.subscriptionEditor.reloadConfirm')
          : t('admin-media.subscriptionEditor.reloadConfirmUnsaved'),
      )
    )
      return
    await load(true)
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || loading.value || !ready.value || ownershipLost.value) return
    if (value.context !== ownedContext || (initialId !== null && value.id !== initialId)) {
      error.value = t('admin-media.subscriptionEditor.recoveryMismatch')
      return
    }
    if (
      dirty.value &&
      JSON.stringify(form) !== JSON.stringify(value.form) &&
      !window.confirm(t('admin-media.subscriptionEditor.restoreConfirm'))
    )
      return
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    serverVersion.value = null
    notice.value = t('admin-media.subscriptionEditor.restored')
    persistLocal()
  }
  function discardRecovery() {
    if (!recovery.value || saving.value || loading.value || ownershipLost.value) return
    const previous = recovery.value
    recovery.value = null
    // 当前键可能已被 watch 更新为新的表单，不得删除新输入；先重存当前内容。
    if (!persistLocal()) {
      recovery.value = previous
      localError.value = t('admin-media.subscriptionEditor.discardFailed')
      return
    }
    if (currentRecoveryKey && currentRecoveryKey !== storageKey()) {
      try {
        sessionStorage.removeItem(currentRecoveryKey)
      } catch {
        localError.value = t('admin-media.subscriptionEditor.discardFailedKept')
      }
    }
    notice.value =
      dirty.value || pendingCreate.value
        ? t('admin-media.subscriptionEditor.discardedKept')
        : t('admin-media.subscriptionEditor.discarded')
  }
  function mergeConflict() {
    const latest = serverVersion.value
    if (!latest || saving.value || loading.value || !ready.value || ownershipLost.value || latest.id !== id.value)
      return
    revision.value = latest.revision
    saved.value = latest
    baseline.value = JSON.stringify(subscriptionForm(latest))
    serverVersion.value = null
    notice.value = t('admin-media.subscriptionEditor.merged')
    error.value = ''
    persistLocal()
  }
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || saving.value || pendingCreate.value) {
      persistLocal()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  function canLeave() {
    if (saving.value || loading.value) return false
    if (!dirty.value && !pendingCreate.value) return true
    const preserved = persistLocal()
    return window.confirm(
      preserved
        ? t('admin-media.subscriptionEditor.leaveConfirm')
        : t('admin-media.subscriptionEditor.leaveConfirmUnsaved'),
    )
  }
  onBeforeRouteLeave(canLeave)
  watch(
    form,
    () => {
      if (ready.value) persistLocal()
    },
    { deep: true },
  )
  watch(
    [() => auth.currentUser.value?.id, () => auth.isLoggedIn.value, context],
    ([next, authenticated]) => {
      if (actor && (!authenticated || next !== actor || context.value !== ownedContext)) {
        // 先按原账号和原内容库保留副本，再撤销操作权限；私密 DOM 由同步可见性门槛移除。
        persistLocal()
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
        recovery.value = null
        previousRecoveries.value = []
        currentRecoveryKey = ''
        pendingCreate.value = null
        Object.assign(form, subscriptionForm())
        baseline.value = JSON.stringify(form)
      }
      if ((!actor || ownedContext === context.value) && !ready.value && !loading.value) void load()
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    persistLocal()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
  return {
    form,
    ownershipLost,
    requiresReload,
    load,
    id,
    saved,
    serverVersion,
    recovery,
    previousRecoveries,
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
    restoreRecovery,
    discardRecovery,
    persistLocal,
    canLeave,
    mergeConflict,
  }
}
