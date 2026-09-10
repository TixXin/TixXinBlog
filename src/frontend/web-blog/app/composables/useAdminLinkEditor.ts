/** @file useAdminLinkEditor.ts @description 友链管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { LinkEditable, LinkStatus, ManagedLink } from '~/features/link/types'
import { linkForm, parseLinkRecovery } from '~/features/link/editor'
import type { LinkRecovery } from '~/features/link/editor'
import { editorRecoveryKey, readEditorRecoveries } from '~/utils/editorRecoveryStorage'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
export function useAdminLinkEditor(initialId: number | null) {
  const repo = useLinkRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp()
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(linkForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const saved = ref<ManagedLink | null>(null),
    serverVersion = ref<ManagedLink | null>(null),
    recovery = ref<LinkRecovery | null>(null)
  const previousRecoveries = ref<EditorRecoveryCopy<LinkRecovery>[]>([])
  let currentRecoveryKey = ''
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref(''),
    localError = ref('')
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const pendingCreate = ref<LinkEditable | null>(null)
  let actor = '',
    requestId = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const storagePrefix = () => `tixxin-link-editor:${actor}:${initialId ?? 'new'}`
  const storageKey = () => editorRecoveryKey(storagePrefix(), ownedContext)
  const owns = (user: string | undefined, version: number) =>
    alive && generation === version && auth.currentUser.value?.id === user && ownedContext === context.value
  function persistLocal() {
    if (!import.meta.client || !actor || (!dirty.value && !pendingCreate.value)) return
    try {
      const value: LinkRecovery = {
        version: 1,
        context: ownedContext,
        id: id.value,
        revision: revision.value,
        requestId,
        form: linkForm(form),
        pendingCreate: pendingCreate.value,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
      localError.value = ''
    } catch {
      localError.value = '恢复副本无法保存，请保留当前输入并重试。'
    }
  }
  function accept(link: ManagedLink) {
    saved.value = link
    id.value = link.id
    revision.value = link.revision
    Object.assign(form, linkForm(link))
    baseline.value = JSON.stringify(form)
    serverVersion.value = null
  }
  async function load(replace = false) {
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
        throw new Error('内容库已恢复或切换，请刷新页面后重新核对友链；当前输入已保留。')
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      try {
        const copies = readEditorRecoveries(sessionStorage, storagePrefix(), ownedContext, parseLinkRecovery)
        recovery.value = copies.current?.value ?? null
        currentRecoveryKey = copies.current?.key ?? storageKey()
        previousRecoveries.value = copies.previous
        if (copies.migrationIssue) localError.value = '旧恢复副本迁移暂未完成，原副本已保留。'
      } catch {
        localError.value = '无法读取本标签页恢复副本。'
      }
      if (replace || (!dirty.value && !saved.value)) {
        const link = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (link) accept(link)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : '友链读取失败'
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }
  function change(value: Partial<LinkEditable>) {
    if (!ready.value) return
    Object.assign(form, value)
    error.value = ''
    notice.value = ''
  }
  async function save(status: LinkStatus) {
    if (!ready.value || saving.value || loading.value || !form.name.trim() || !form.url.trim()) return
    const user = auth.currentUser.value?.id,
      version = generation,
      capture = JSON.stringify(form)
    const recoveringMatches =
      !pendingCreate.value ||
      JSON.stringify({ ...linkForm(form), status: pendingCreate.value.status }) === JSON.stringify(pendingCreate.value)
    if (!user || user !== actor || ownedContext !== context.value) {
      ready.value = false
      error.value = '登录或内容上下文已变化，请重新读取后核对。'
      return
    }
    saving.value = true
    error.value = ''
    notice.value = ''
    let redirect: string | undefined
    try {
      let link: ManagedLink | null = null
      if (!id.value && pendingCreate.value) {
        try {
          const known = await repo.submission(requestId)
          if (!owns(user, version)) return
          if (known.state === 'deleted') throw new Error('此前提交的友链已删除，不能自动重新创建；当前输入已保留。')
          link = known.item
        } catch (cause) {
          if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
        }
      }
      if (!link) {
        const body = !id.value && pendingCreate.value ? pendingCreate.value : { ...linkForm(form), status }
        if (!id.value) pendingCreate.value = body
        persistLocal()
        link = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(user, version)) return
      const wasNew = id.value === null
      saved.value = link
      id.value = link.id
      revision.value = link.revision
      pendingCreate.value = null
      serverVersion.value = null
      baseline.value = JSON.stringify(linkForm(link))
      if (JSON.stringify(form) === capture && recoveringMatches) Object.assign(form, linkForm(link))
      notice.value = dirty.value ? '已核查服务器友链，当前新增输入仍保留，请核对后继续保存。' : '友链已保存。'
      if (!dirty.value) {
        try {
          sessionStorage.removeItem(storageKey())
        } catch {
          localError.value = '友链已保存，但本机恢复副本暂时无法清理。'
        }
        recovery.value = null
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(['links-feed', 'links-metadata']))
      if (wasNew && !dirty.value) redirect = `/admin/links/${link.id}`
    } catch (cause) {
      if (!owns(user, version)) return
      error.value = cause instanceof Error ? cause.message : '保存失败，当前输入已保留'
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
      if (!id.value && pendingCreate.value) error.value += '。保存结果尚未核清，再次保存会先核查原提交。'
      persistLocal()
    } finally {
      if (alive && generation === version) saving.value = false
    }
    if (redirect && owns(user, version)) await router.replace(redirect)
  }
  async function reload() {
    if (saving.value || (dirty.value && !window.confirm('当前输入会保留为恢复副本，是否读取服务器最新版本？'))) return
    persistLocal()
    await load(true)
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || !ready.value) return
    if (value.context !== ownedContext || (initialId !== null && value.id !== initialId)) {
      error.value = '恢复副本属于不同内容库或友链，不能直接提交；请根据副本内容重新编辑。'
      return
    }
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    notice.value = '已恢复输入，请核对后手动保存。'
  }
  function discardRecovery() {
    try {
      sessionStorage.removeItem(currentRecoveryKey || storageKey())
      recovery.value = null
    } catch {
      localError.value = '恢复副本暂时无法移除。'
    }
  }
  function mergeConflict() {
    const latest = serverVersion.value
    if (!latest || saving.value || !ready.value || latest.id !== id.value) return
    revision.value = latest.revision
    saved.value = latest
    baseline.value = JSON.stringify(linkForm(latest))
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
  onBeforeRouteLeave(() => {
    if (saving.value) return false
    if (!dirty.value && !pendingCreate.value) return true
    persistLocal()
    return window.confirm('有尚未保存或待核查的友链输入，已保留本标签页副本，确定离开吗？')
  })
  watch(form, persistLocal, { deep: true })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (actor && next !== actor) {
        persistLocal()
        generation++
        ready.value = false
        saving.value = false
        loading.value = false
        if (next) {
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
          Object.assign(form, linkForm())
          baseline.value = JSON.stringify(form)
          void load()
        }
      } else if (next && !ready.value && !loading.value) void load()
    },
  )
  watch(context, () => {
    if (actor && context.value !== ownedContext) {
      persistLocal()
      generation++
      ready.value = false
      saving.value = false
      loading.value = false
      error.value = '内容库已恢复或切换，请刷新页面后重新核对；输入已保留。'
    }
  })
  onScopeDispose(() => {
    persistLocal()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
  return {
    form,
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
    mergeConflict,
  }
}
