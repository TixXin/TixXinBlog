/** @file useAdminGalleryEditor.ts @description 图库管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { GalleryEditable, GalleryStatus, ManagedPhoto } from '~/features/gallery/types'
import { galleryForm, parseGalleryRecovery } from '~/features/gallery/editor'
import type { GalleryRecovery } from '~/features/gallery/editor'
export function useAdminGalleryEditor(initialId: number | null) {
  const repo = useGalleryRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp()
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(galleryForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const saved = ref<ManagedPhoto | null>(null),
    serverVersion = ref<ManagedPhoto | null>(null),
    recovery = ref<GalleryRecovery | null>(null)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref(''),
    localError = ref('')
  const baseline = ref(JSON.stringify(form)),
    dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const pendingCreate = ref<GalleryEditable | null>(null)
  let actor = '',
    requestId = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const storageKey = () => `tixxin-gallery-editor:${actor}:${initialId ?? 'new'}`
  const owns = (user: string | undefined, version: number) =>
    alive && generation === version && auth.currentUser.value?.id === user && ownedContext === context.value
  function persistLocal() {
    if (!import.meta.client || !actor || (!dirty.value && !pendingCreate.value)) return
    try {
      const value: GalleryRecovery = {
        version: 1,
        context: ownedContext,
        id: id.value,
        revision: revision.value,
        requestId,
        form: galleryForm(form),
        pendingCreate: pendingCreate.value,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
      localError.value = ''
    } catch {
      localError.value = '恢复副本无法保存，请保留当前输入并重试。'
    }
  }
  function accept(photo: ManagedPhoto) {
    saved.value = photo
    id.value = photo.id
    revision.value = photo.revision
    Object.assign(form, galleryForm(photo))
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
        throw new Error('内容库已恢复或切换，请刷新页面后重新核对作品；当前输入已保留。')
      if (replace || (!dirty.value && !saved.value)) {
        const photo = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (photo) accept(photo)
      }
      if (!owns(user, version)) return
      ready.value = true
      try {
        recovery.value = parseGalleryRecovery(sessionStorage.getItem(storageKey()))
      } catch {
        localError.value = '无法读取本标签页恢复副本。'
      }
    } catch (cause) {
      if (alive && version === generation) error.value = cause instanceof Error ? cause.message : '作品读取失败'
    } finally {
      if (alive && version === generation) loading.value = false
    }
  }
  function change(value: Partial<GalleryEditable>) {
    if (!ready.value) return
    Object.assign(form, value)
    error.value = ''
    notice.value = ''
  }
  async function save(status: GalleryStatus) {
    if (!ready.value || saving.value || loading.value || !form.title.trim() || !form.mediaId) return
    const user = auth.currentUser.value?.id,
      version = generation,
      capture = JSON.stringify(form)
    const recoveringMatches =
      !pendingCreate.value ||
      JSON.stringify({ ...galleryForm(form), status: pendingCreate.value.status }) ===
        JSON.stringify(pendingCreate.value)
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
      let photo: ManagedPhoto | null = null
      if (!id.value && pendingCreate.value) {
        try {
          const known = await repo.submission(requestId)
          if (!owns(user, version)) return
          if (known.state === 'deleted') throw new Error('此前提交的作品已删除，不能自动重新创建；当前输入已保留。')
          photo = known.item
        } catch (cause) {
          if ((cause as { statusCode?: number }).statusCode !== 404) throw cause
        }
      }
      if (!photo) {
        const body = !id.value && pendingCreate.value ? pendingCreate.value : { ...galleryForm(form), status }
        if (!id.value) pendingCreate.value = body
        persistLocal()
        photo = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      }
      if (!owns(user, version)) return
      const wasNew = id.value === null
      saved.value = photo
      id.value = photo.id
      revision.value = photo.revision
      pendingCreate.value = null
      serverVersion.value = null
      baseline.value = JSON.stringify(galleryForm(photo))
      if (JSON.stringify(form) === capture && recoveringMatches) Object.assign(form, galleryForm(photo))
      notice.value = dirty.value ? '已核查服务器作品，当前新增输入仍保留，请核对后继续保存。' : '作品已保存。'
      if (!dirty.value) {
        sessionStorage.removeItem(storageKey())
        recovery.value = null
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(['gallery-feed', 'gallery-metadata']))
      if (wasNew && !dirty.value) redirect = `/admin/gallery/${photo.id}`
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
      error.value = '恢复副本属于不同内容库或作品，不能直接提交；请根据副本内容重新编辑。'
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
      sessionStorage.removeItem(storageKey())
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
    baseline.value = JSON.stringify(galleryForm(latest))
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
    return window.confirm('有尚未保存或待核查的作品输入，已保留本标签页副本，确定离开吗？')
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
          pendingCreate.value = null
          Object.assign(form, galleryForm())
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
