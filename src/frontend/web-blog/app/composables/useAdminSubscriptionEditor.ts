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
export function useAdminSubscriptionEditor(initialId: number | null, options: { inline?: boolean } = {}) {
  const repo = useSubscriptionRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp()
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
      localError.value = '恢复副本无法保存，请保留当前输入并重试。'
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
      if (!(await auth.restore())) throw new Error('请先登录博主账号，当前输入仍保留。')
      const user = auth.currentUser.value!.id
      if (!alive || version !== generation) return
      actor ||= user
      ownedContext ||= context.value
      requestId ||= crypto.randomUUID()
      if (ownedContext !== context.value)
        throw new Error('内容库已恢复或切换，请刷新页面后重新核对订阅；当前输入已保留。')
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      try {
        const copies = readEditorRecoveries(sessionStorage, storagePrefix(), ownedContext, parseSubscriptionRecovery)
        recovery.value = copies.current?.value ?? null
        currentRecoveryKey = copies.current?.key ?? storageKey()
        previousRecoveries.value = copies.previous
        if (copies.migrationIssue) localError.value = '旧恢复副本迁移暂未完成，原副本已保留。'
      } catch {
        localError.value = '无法读取本标签页恢复副本。'
      }
      if (replace || (!dirty.value && !saved.value)) {
        const subscription = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (subscription) accept(subscription)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : '订阅读取失败'
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
      error.value = '登录或内容上下文已变化，请重新读取后核对。'
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
          if (known.state === 'deleted') throw new Error('此前提交的订阅已删除，不能自动重新创建；当前输入已保留。')
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
      notice.value = dirty.value ? '已核查服务器订阅，当前新增输入仍保留，请核对后继续保存。' : '订阅已保存。'
      if (!dirty.value) {
        try {
          sessionStorage.removeItem(storageKey())
          recovery.value = null
        } catch {
          localError.value = '订阅已保存，旧恢复副本暂时无法移除。'
        }
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(['subscriptions-feed']))
      if (wasNew && !dirty.value && !options.inline) redirect = `/admin/subscriptions/${subscription.id}`
    } catch (cause) {
      if (!owns(user, version)) return
      error.value = cause instanceof Error ? cause.message : '保存失败，当前输入已保留'
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
      if (!id.value && pendingCreate.value) error.value += '。保存结果尚未核清，再次保存会先核查原提交。'
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
          ? '当前输入已保留为恢复副本，是否读取服务器最新版本？'
          : '恢复副本未能保存，读取服务器版本会覆盖当前输入并可能丢失。确定继续吗？',
      )
    )
      return
    await load(true)
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || loading.value || !ready.value || ownershipLost.value) return
    if (value.context !== ownedContext || (initialId !== null && value.id !== initialId)) {
      error.value = '恢复副本属于不同内容库或订阅，不能直接提交；请根据副本内容重新编辑。'
      return
    }
    if (
      dirty.value &&
      JSON.stringify(form) !== JSON.stringify(value.form) &&
      !window.confirm('恢复副本会替换当前表单中未保存的修改，确定恢复吗？')
    )
      return
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    serverVersion.value = null
    notice.value = '已恢复输入，请核对后手动保存。'
    persistLocal()
  }
  function discardRecovery() {
    if (!recovery.value || saving.value || loading.value || ownershipLost.value) return
    const previous = recovery.value
    recovery.value = null
    // 当前键可能已被 watch 更新为新的表单，不得删除新输入；先重存当前内容。
    if (!persistLocal()) {
      recovery.value = previous
      localError.value = '暂时无法移除旧副本，当前输入仍保留在本标签页。'
      return
    }
    if (currentRecoveryKey && currentRecoveryKey !== storageKey()) {
      try {
        sessionStorage.removeItem(currentRecoveryKey)
      } catch {
        localError.value = '当前输入已保留，但旧恢复副本暂时无法移除。'
      }
    }
    notice.value =
      dirty.value || pendingCreate.value ? '已移除旧恢复副本，当前输入仍保留在本标签页。' : '已移除恢复副本。'
  }
  function mergeConflict() {
    const latest = serverVersion.value
    if (!latest || saving.value || loading.value || !ready.value || ownershipLost.value || latest.id !== id.value)
      return
    revision.value = latest.revision
    saved.value = latest
    baseline.value = JSON.stringify(subscriptionForm(latest))
    serverVersion.value = null
    notice.value = '已保留输入并采用服务器最新版本，请核对合并内容后手动保存。'
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
        ? '有尚未保存或待核查的订阅输入，已保留本标签页副本，确定离开吗？'
        : '有尚未保存或待核查的订阅输入，恢复副本未能保存；离开后可能丢失。确定离开吗？',
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
        error.value = '身份或内容库已变化，输入已按原归属保留，请重新核对后继续。'
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
