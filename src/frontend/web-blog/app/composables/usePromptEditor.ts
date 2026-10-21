/** @file usePromptEditor.ts @description 页内提示词编辑：幂等核查、版本冲突、账号隔离和标签页输入恢复 */
import { promptId } from '~/features/prompt/query'
import { promptForm, promptFormError } from '~/features/prompt/editor'
import { usePromptPersistence } from '~/features/prompt/usePromptPersistence'
import type { PromptRecovery } from '~/features/prompt/editor'
import type { ManagedPrompt, PromptForm, PromptRequestError, PromptStatus } from '~/features/prompt/types'

export function usePromptEditor(initialId: number | null, onSaved: (item: ManagedPrompt) => void) {
  const repo = usePromptRepository(),
    auth = useCurrentUser()
  // 用全局 i18n 实例而非 useI18n：提示在产生时按当前语言翻译
  const { t } = useNuxtApp().$i18n
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(promptForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref('')
  const localError = ref(''),
    recovery = ref<PromptRecovery | null>(null),
    serverVersion = ref<ManagedPrompt | null>(null),
    requiresReload = ref(false)
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const pendingCreate = ref<PromptForm | null>(null)
  const storageId = ref(initialId)
  let actor = '',
    ownedContext = '',
    requestId = '',
    alive = true,
    generation = 0

  const persistence = usePromptPersistence({
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
    getMeta: () => ({ actor, ownedContext, requestId }),
    setRequestId: (val) => {
      requestId = val
    },
    t,
  })

  const ownershipLost = computed(() => {
    const currentActor = auth.currentUser.value?.id,
      currentContext = context.value,
      authenticated = auth.isLoggedIn.value
    return !!actor && (!authenticated || currentActor !== actor || currentContext !== ownedContext)
  })
  const owns = (version: number) =>
    alive &&
    version === generation &&
    auth.isLoggedIn.value &&
    auth.currentUser.value?.id === actor &&
    context.value === ownedContext

  function accept(item: ManagedPrompt) {
    id.value = item.id
    revision.value = item.revision
    Object.assign(form, promptForm(item))
    baseline.value = JSON.stringify(form)
  }

  async function load() {
    if (requiresReload.value) return
    const version = ++generation
    loading.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error(t('misc.prompt.editorState.loginRequired'))
      if (!alive || version !== generation) return
      const currentActor = auth.currentUser.value!.id
      if (actor && (actor !== currentActor || ownedContext !== context.value))
        throw new Error(t('misc.prompt.editorState.contextChangedReopen'))
      actor = currentActor
      ownedContext = context.value
      requestId ||= crypto.randomUUID()
      persistence.readRecovery()
      const item = initialId ? await repo.adminDetail(initialId) : null
      if (!owns(version)) return
      if (item && !dirty.value) accept(item)
      ready.value = true
    } catch (cause) {
      if (alive && version === generation)
        error.value = cause instanceof Error ? cause.message : t('misc.prompt.editorState.loadFailed')
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }

  async function save(status: PromptStatus) {
    if (!ready.value || saving.value || loading.value) return
    const validation = promptFormError(form, t)
    if (validation) {
      error.value = validation
      return
    }
    const version = generation
    if (!owns(version)) {
      error.value = t('misc.prompt.editorState.contextChanged')
      return
    }
    const capture = JSON.stringify(form)
    saving.value = true
    error.value = ''
    notice.value = ''
    try {
      let item: ManagedPrompt | null = null
      if (!id.value && pendingCreate.value) {
        try {
          item = (await repo.submission(requestId)).item
        } catch (cause) {
          if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
        }
        if (!owns(version)) return
      }
      const body = !id.value && pendingCreate.value ? pendingCreate.value : { ...promptForm(form), status }
      if (!item) {
        if (!id.value) {
          pendingCreate.value = body
          persistence.persist()
        }
        item = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(version)) return
      const originalMatches = JSON.stringify({ ...promptForm(form), status: body.status }) === JSON.stringify(body)
      const previousKey = persistence.storageKey()
      id.value = item.id
      storageId.value = item.id
      revision.value = item.revision
      baseline.value = JSON.stringify(promptForm(item))
      // 网络核查期间或保存期间新增的文字始终留在编辑器，不被较早请求覆盖。
      if (capture === JSON.stringify(form) && originalMatches) Object.assign(form, promptForm(item))
      pendingCreate.value = null
      serverVersion.value = null
      recovery.value = null
      persistence.moveRecoveryToSavedItem(previousKey)
      notice.value = dirty.value
        ? t('misc.prompt.editorState.savedWithPending')
        : item.status === 'published'
          ? t('misc.prompt.editorState.published')
          : t('misc.prompt.editorState.draftSaved')
      onSaved(item)
    } catch (cause) {
      if (!owns(version)) return
      error.value = cause instanceof Error ? cause.message : t('misc.prompt.editorState.saveFailed')
      const { statusCode, conflictKind } = cause as PromptRequestError
      if (statusCode === 400) pendingCreate.value = null
      if (statusCode === 409) {
        // 内容库或身份变化不能按同编号的新内容合并；只有明确的作品版本冲突才读取对照。
        serverVersion.value = null
        if (conflictKind === 'context') {
          ready.value = false
          requiresReload.value = true
        }
        if (conflictKind === 'revision' && id.value) {
          try {
            const latest = await repo.adminDetail(id.value)
            if (owns(version)) serverVersion.value = latest
          } catch {
            /* 原始错误和本地输入保持不变。 */
          }
        }
      }
      if (!id.value && pendingCreate.value) error.value += ' ' + t('misc.prompt.editorState.retryWillVerify')
      persistence.persist()
    } finally {
      if (alive && generation === version) saving.value = false
    }
  }

  function merge() {
    if (!serverVersion.value || saving.value || !ready.value) return
    revision.value = serverVersion.value.revision
    baseline.value = JSON.stringify(promptForm(serverVersion.value))
    serverVersion.value = null
    error.value = ''
    notice.value = t('misc.prompt.editorState.merged')
    persistence.persist()
  }

  function canClose() {
    if (saving.value) return false
    if (!dirty.value && !pendingCreate.value) return true
    const preserved = persistence.persist()
    return window.confirm(
      preserved ? t('misc.prompt.editorState.closeConfirm') : t('misc.prompt.editorState.closeConfirmUnsaved'),
    )
  }

  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || saving.value || pendingCreate.value) {
      persistence.persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }

  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(canClose)
  onBeforeRouteUpdate((to, from) => {
    const editToken = (value: unknown) => (value === 'new' ? 'new' : (promptId(value)?.toString() ?? null))
    const previous = editToken(from.query.edit),
      next = editToken(to.query.edit)
    if (previous === next) return true
    // 同一份新建作品确认保存后，URL归属真实编号；页内筛选和状态切换也不离开编辑会话。
    if (previous === 'new' && id.value !== null && next === String(id.value)) return true
    return canClose()
  })
  watch(form, persistence.persist, { deep: true })
  watch([() => auth.currentUser.value?.id, () => auth.isLoggedIn.value, context], () => {
    if (actor && (!auth.isLoggedIn.value || auth.currentUser.value?.id !== actor || context.value !== ownedContext)) {
      persistence.persist()
      generation++
      ready.value = false
      saving.value = false
      loading.value = false
      error.value = t('misc.prompt.editorState.ownershipLost')
    }
  })
  onScopeDispose(() => {
    persistence.persist()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })

  return {
    form,
    id,
    ready,
    loading,
    saving,
    error,
    notice,
    localError,
    recovery,
    serverVersion,
    requiresReload,
    ownershipLost,
    dirty,
    pendingCreate,
    load,
    save,
    restoreRecovery: persistence.restoreRecovery,
    discardRecovery: persistence.discardRecovery,
    merge,
    persist: persistence.persist,
    canClose,
  }
}
