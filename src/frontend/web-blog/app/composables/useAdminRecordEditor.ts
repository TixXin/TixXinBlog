/** @file useAdminRecordEditor.ts @description 后台实体记录编辑器通用核心，管理账号隔离、提交核查、版本冲突与输入恢复 */
import { editorRecoveryKey } from '~/utils/editorRecoveryStorage'
import { currentTranslate } from '~/utils/format'
import {
  createEditorState,
  createRecordRecovery,
  isPendingCreateMatched,
  readRecoveriesSafe,
  removeRecoverySafe,
  useEditorLifecycle,
} from './useAdminRecordEditor.types'
import type { AdminRecordEditorOptions, AdminRecordRecovery } from './useAdminRecordEditor.types'
export * from './useAdminRecordEditor.types'

export function useAdminRecordEditor<
  TForm extends object & { status: TStatus },
  TEntity extends { id: number; revision: number },
  TStatus extends string,
  TRecovery extends AdminRecordRecovery<TForm>,
>(options: AdminRecordEditorOptions<TForm, TEntity, TStatus, TRecovery>) {
  const { initialId, storagePrefix: domain, recoveryVersion = 1, repo, messages } = options
  const auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp()
  // 在 setup 内取翻译函数：失败处理发生在 await 之后仍可使用
  const t = currentTranslate()
  const context = useState<string>('page-content-context', () => '')
  const state = createEditorState<TForm, TEntity, TRecovery>(initialId, options.createDefaultForm())
  const { form, id, revision, saved, serverVersion, recovery, previousRecoveries, pendingCreate } = state
  const { ready, loading, saving, error, notice, localError } = state
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  let currentRecoveryKey = '',
    actor = '',
    requestId = '',
    ownedContext = '',
    generation = 0,
    alive = true

  const storagePrefix = () => `${domain}:${actor}:${initialId ?? 'new'}`
  const storageKey = () => editorRecoveryKey(storagePrefix(), ownedContext)
  const owns = (user: string | undefined, version: number) =>
    alive && generation === version && auth.currentUser.value?.id === user && ownedContext === context.value

  function invalidate(nextError = '') {
    persistLocal()
    generation++
    ready.value = saving.value = loading.value = false
    if (nextError) error.value = nextError
  }

  function resetSession(nextActor: string) {
    actor = nextActor
    requestId = currentRecoveryKey = ''
    ownedContext = context.value
    id.value = initialId
    revision.value = saved.value = serverVersion.value = recovery.value = pendingCreate.value = null
    previousRecoveries.value = []
    Object.assign(form, options.createDefaultForm())
    baseline.value = JSON.stringify(form)
  }

  function persistLocal() {
    if (!import.meta.client || !actor || (!dirty.value && !pendingCreate.value)) return
    try {
      const value = createRecordRecovery(
        recoveryVersion,
        ownedContext,
        id.value,
        revision.value,
        requestId,
        options.cloneForm(form),
        pendingCreate.value,
      )
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
      localError.value = ''
    } catch {
      localError.value = t(messages.persistFailed)
    }
  }

  function accept(entity: TEntity, nextForm?: TForm) {
    saved.value = entity
    id.value = entity.id
    revision.value = entity.revision
    serverVersion.value = null
    const raw = options.entityToForm(entity)
    baseline.value = JSON.stringify(raw)
    Object.assign(form, nextForm ?? raw)
  }

  async function load(replace = false) {
    const version = ++generation
    loading.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error(t(messages.loginRequired))
      const user = auth.currentUser.value!.id
      if (!alive || version !== generation) return
      actor ||= user
      ownedContext ||= context.value
      requestId ||= crypto.randomUUID()
      if (ownedContext !== context.value) throw new Error(t(messages.contextChangedOnLoad))
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      const recovered = readRecoveriesSafe(
        sessionStorage,
        storagePrefix(),
        ownedContext,
        options.parseRecovery,
        storageKey(),
      )
      recovery.value = recovered.recovery
      currentRecoveryKey = recovered.key
      previousRecoveries.value = recovered.previous
      if (recovered.migrationIssue) localError.value = t(messages.migrationIssue)
      if (recovered.failed) localError.value = t(messages.recoveryUnreadable)
      if (replace || (!dirty.value && !saved.value)) {
        const entity = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (entity) accept(entity)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : t(messages.loadFailed)
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }

  function change(value: Partial<TForm>) {
    if (!ready.value) return
    Object.assign(form, value)
    error.value = notice.value = ''
  }

  async function save(status: TStatus) {
    if (!ready.value || saving.value || loading.value || !options.canSave(form)) return
    const user = auth.currentUser.value?.id,
      version = generation,
      capture = JSON.stringify(form)
    const recoveringMatches = isPendingCreateMatched(pendingCreate.value, form, options.cloneForm)
    if (!user || user !== actor || ownedContext !== context.value) {
      ready.value = false
      error.value = t(messages.contextChanged)
      return
    }
    saving.value = true
    error.value = notice.value = ''
    let redirect: string | undefined
    try {
      let entity: TEntity | null = null
      if (!id.value && pendingCreate.value) {
        try {
          const known = await repo.submission(requestId)
          if (!owns(user, version)) return
          if (known.state === 'deleted') throw new Error(t(messages.submissionDeleted))
          entity = known.item
        } catch (cause) {
          if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
        }
      }
      if (!entity) {
        const body =
          !id.value && pendingCreate.value ? pendingCreate.value : ({ ...options.cloneForm(form), status } as TForm)
        if (!id.value) pendingCreate.value = body
        persistLocal()
        entity = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(user, version)) return
      const wasNew = id.value === null
      const rawAccepted = options.entityToForm(entity)
      const accepted = options.processAccepted
        ? options.processAccepted(options.cloneForm(rawAccepted), form)
        : rawAccepted
      const shouldSync = JSON.stringify(form) === capture && recoveringMatches
      accept(entity, shouldSync ? accepted : form)
      pendingCreate.value = null
      notice.value = dirty.value ? t(messages.savedDirty) : t(messages.saved)
      if (!dirty.value) {
        if (!removeRecoverySafe(storageKey()) && messages.recoveryNotRemoved) {
          localError.value = t(messages.recoveryNotRemoved)
        }
        recovery.value = null
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(options.refreshKeys))
      if (wasNew && !dirty.value) redirect = options.redirectPath(entity)
    } catch (cause) {
      if (!owns(user, version)) return
      error.value = cause instanceof Error ? cause.message : t(messages.saveFailed)
      const statusCode = (cause as { statusCode?: number }).statusCode
      if (statusCode === 400) pendingCreate.value = null
      if (statusCode === 409 && id.value) {
        try {
          const latest = await repo.adminDetail(id.value)
          if (owns(user, version)) serverVersion.value = latest
        } catch {
          /* 保留原错误和输入。 */
        }
      }
      if (!id.value && pendingCreate.value) error.value += t(messages.pendingHint)
      persistLocal()
    } finally {
      if (alive && generation === version) saving.value = false
    }
    if (redirect && owns(user, version)) await router.replace(redirect)
  }

  async function reload() {
    if (saving.value || (dirty.value && !window.confirm(t(messages.reloadConfirm)))) return
    persistLocal()
    await load(true)
  }

  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || !ready.value) return
    if (value.context !== ownedContext || (initialId !== null && value.id !== initialId)) {
      error.value = t(messages.recoveryMismatch)
      return
    }
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    notice.value = t(messages.restored)
  }

  function discardRecovery() {
    if (!removeRecoverySafe(currentRecoveryKey || storageKey())) localError.value = t(messages.discardFailed)
    else recovery.value = null
  }

  function mergeConflict() {
    const latest = serverVersion.value
    if (!latest || saving.value || !ready.value || latest.id !== id.value) return
    revision.value = latest.revision
    saved.value = latest
    serverVersion.value = null
    baseline.value = JSON.stringify(options.entityToForm(latest))
    notice.value = t(messages.merged)
    error.value = ''
    persistLocal()
  }

  onMounted(() => void load())
  useEditorLifecycle(
    persistLocal,
    () => dirty.value || saving.value || Boolean(pendingCreate.value),
    () => saving.value,
    () => window.confirm(t(messages.leaveConfirm)),
  )

  watch(form, persistLocal, { deep: true })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (actor && next !== actor) {
        invalidate()
        if (next) {
          resetSession(next)
          void load()
        }
      } else if (next && !ready.value && !loading.value) void load()
    },
  )

  watch(context, () => {
    if (actor && context.value !== ownedContext) invalidate(t(messages.contextSwitched))
  })

  onScopeDispose(() => {
    alive = false
    generation++
  })

  return {
    ...state,
    dirty,
    change,
    save,
    reload,
    restoreRecovery,
    discardRecovery,
    persistLocal,
    mergeConflict,
  }
}
