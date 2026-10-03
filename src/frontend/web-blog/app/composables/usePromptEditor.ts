/** @file usePromptEditor.ts @description 页内提示词编辑：幂等核查、版本冲突、账号隔离和标签页输入恢复 */
import { parsePromptRecovery, promptForm, promptFormError } from '~/features/prompt/editor'
import type { PromptRecovery } from '~/features/prompt/editor'
import type { ManagedPrompt, PromptForm, PromptStatus } from '~/features/prompt/types'
export function usePromptEditor(initialId: number | null, onSaved: (item: ManagedPrompt) => void) {
  const repo = usePromptRepository(),
    auth = useCurrentUser()
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
    serverVersion = ref<ManagedPrompt | null>(null)
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const pendingCreate = ref<PromptForm | null>(null)
  let actor = '',
    ownedContext = '',
    requestId = '',
    alive = true,
    generation = 0
  const storageKey = () => `tixxin-prompt-editor:${actor}:${ownedContext}:${initialId ?? 'new'}`
  const owns = (version: number) =>
    alive && version === generation && auth.currentUser.value?.id === actor && context.value === ownedContext
  function persist() {
    if (!import.meta.client || !actor || (!dirty.value && !pendingCreate.value)) return
    try {
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
    } catch {
      localError.value = '恢复副本暂时无法保存，请保留当前页面。'
    }
  }
  function accept(item: ManagedPrompt) {
    id.value = item.id
    revision.value = item.revision
    Object.assign(form, promptForm(item))
    baseline.value = JSON.stringify(form)
  }
  async function load() {
    const version = ++generation
    loading.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error('请先登录博主账号，当前输入已保留。')
      if (!alive || version !== generation) return
      const currentActor = auth.currentUser.value!.id
      if (actor && (actor !== currentActor || ownedContext !== context.value))
        throw new Error('登录账号或内容库已变化，请重新打开编辑器；当前副本已保留。')
      actor = currentActor
      ownedContext = context.value
      requestId ||= crypto.randomUUID()
      try {
        recovery.value = parsePromptRecovery(sessionStorage.getItem(storageKey()))
      } catch {
        localError.value = '无法读取本标签页恢复副本。'
      }
      const item = initialId ? await repo.adminDetail(initialId) : null
      if (!owns(version)) return
      if (item && !dirty.value) accept(item)
      ready.value = true
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : '读取失败，请重试。'
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }
  async function save(status: PromptStatus) {
    if (!ready.value || saving.value || loading.value) return
    const validation = promptFormError(form)
    if (validation) {
      error.value = validation
      return
    }
    const version = generation
    if (!owns(version)) {
      error.value = '登录账号或内容库已变化，当前输入已保留。'
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
          persist()
        }
        item = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(version)) return
      const originalMatches = JSON.stringify({ ...promptForm(form), status: body.status }) === JSON.stringify(body)
      id.value = item.id
      revision.value = item.revision
      baseline.value = JSON.stringify(promptForm(item))
      // 网络核查期间或保存期间新增的文字始终留在编辑器，不被较早请求覆盖。
      if (capture === JSON.stringify(form) && originalMatches) Object.assign(form, promptForm(item))
      pendingCreate.value = null
      serverVersion.value = null
      if (!dirty.value) {
        try {
          sessionStorage.removeItem(storageKey())
          recovery.value = null
        } catch {
          /* 已保存内容以服务器为准。 */
        }
      } else persist()
      notice.value = dirty.value
        ? '此前提交已保存，后续输入仍保留，请核对后继续保存。'
        : item.status === 'published'
          ? '已发布，访客现在可以浏览和复制。'
          : '草稿已保存，仅博主可见。'
      onSaved(item)
    } catch (cause) {
      if (!owns(version)) return
      error.value = cause instanceof Error ? cause.message : '保存失败，当前输入已保留。'
      const statusCode = (cause as { statusCode?: number }).statusCode
      if (statusCode === 400) pendingCreate.value = null
      if (statusCode === 409 && id.value) {
        try {
          const latest = await repo.adminDetail(id.value)
          if (owns(version)) serverVersion.value = latest
        } catch {
          /* 原始错误和本地输入保持不变。 */
        }
      }
      if (!id.value && pendingCreate.value) error.value += ' 再次保存将先核查原提交，避免重复创建。'
      persist()
    } finally {
      if (alive && generation === version) saving.value = false
    }
  }
  function restoreRecovery() {
    const value = recovery.value
    if (
      !value ||
      !ready.value ||
      saving.value ||
      value.context !== ownedContext ||
      (initialId !== null && value.id !== initialId)
    )
      return
    Object.assign(form, promptForm(value.form))
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    notice.value = '已恢复输入，请核对后保存。'
  }
  function discardRecovery() {
    try {
      sessionStorage.removeItem(storageKey())
      recovery.value = null
    } catch {
      localError.value = '暂时无法移除恢复副本。'
    }
  }
  function merge() {
    if (!serverVersion.value || saving.value || !ready.value) return
    revision.value = serverVersion.value.revision
    baseline.value = JSON.stringify(promptForm(serverVersion.value))
    serverVersion.value = null
    error.value = ''
    notice.value = '已保留当前输入，请核对与最新版本的差异后手动保存。'
    persist()
  }
  function canClose() {
    if (saving.value) return false
    if (!dirty.value && !pendingCreate.value) return true
    persist()
    return window.confirm('还有未保存或待核查的输入，已保留本标签页副本，确定关闭吗？')
  }
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || saving.value || pendingCreate.value) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(canClose)
  watch(form, persist, { deep: true })
  watch([() => auth.currentUser.value?.id, context], () => {
    if (actor && (auth.currentUser.value?.id !== actor || context.value !== ownedContext)) {
      persist()
      generation++
      ready.value = false
      saving.value = false
      loading.value = false
      error.value = '登录账号或内容库已变化，请关闭后重新打开；原输入副本已保留。'
    }
  })
  onScopeDispose(() => {
    persist()
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
    dirty,
    pendingCreate,
    load,
    save,
    restoreRecovery,
    discardRecovery,
    merge,
    persist,
    canClose,
  }
}
