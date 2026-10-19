/** @file useAdminGalleryEditor.ts @description 图库管理编辑，账号隔离、提交核查、版本冲突与输入恢复 */
import type { GalleryEditable, GalleryStatus, ManagedPhoto } from '~/features/gallery/types'
import { galleryForm, galleryUrlError, parseGalleryRecovery } from '~/features/gallery/editor'
import type { GalleryRecovery } from '~/features/gallery/editor'
import { editorRecoveryKey, readEditorRecoveries } from '~/utils/editorRecoveryStorage'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
export function useAdminGalleryEditor(initialId: number | null) {
  const repo = useGalleryRepository(),
    auth = useCurrentUser(),
    router = useRouter(),
    app = useNuxtApp(),
    t = currentTranslate()
  const context = useState<string>('page-content-context', () => '')
  const form = reactive(galleryForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const saved = ref<ManagedPhoto | null>(null),
    serverVersion = ref<ManagedPhoto | null>(null),
    recovery = ref<GalleryRecovery | null>(null)
  const previousRecoveries = ref<EditorRecoveryCopy<GalleryRecovery>[]>([])
  let currentRecoveryKey = ''
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
  const storagePrefix = () => `blog-gallery-editor:${actor}:${initialId ?? 'new'}`
  const storageKey = () => editorRecoveryKey(storagePrefix(), ownedContext)
  const owns = (user: string | undefined, version: number) =>
    alive && generation === version && auth.currentUser.value?.id === user && ownedContext === context.value
  function persistLocal() {
    if (!import.meta.client || !actor || (!dirty.value && !pendingCreate.value)) return
    try {
      const value: GalleryRecovery = {
        version: 2,
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
      localError.value = t('admin-media.galleryEditor.persistFailed')
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
      if (!(await auth.restore())) throw new Error(t('admin-media.galleryEditor.loginRequired'))
      const user = auth.currentUser.value!.id
      if (!alive || version !== generation) return
      actor ||= user
      ownedContext ||= context.value
      requestId ||= crypto.randomUUID()
      if (ownedContext !== context.value) throw new Error(t('admin-media.galleryEditor.contextChangedOnLoad'))
      // 新库可能已没有同编号记录；先保留只读副本入口，再读取服务器详情。
      try {
        const copies = readEditorRecoveries(sessionStorage, storagePrefix(), ownedContext, parseGalleryRecovery)
        recovery.value = copies.current?.value ?? null
        currentRecoveryKey = copies.current?.key ?? storageKey()
        previousRecoveries.value = copies.previous
        if (copies.migrationIssue) localError.value = t('admin-media.galleryEditor.migrationIssue')
      } catch {
        localError.value = t('admin-media.galleryEditor.recoveryUnreadable')
      }
      if (replace || (!dirty.value && !saved.value)) {
        const photo = id.value ? await repo.adminDetail(id.value) : null
        if (!owns(user, version)) return
        if (photo) accept(photo)
      }
      if (!owns(user, version)) return
      ready.value = true
    } catch (cause) {
      if (alive && version === generation)
        error.value = cause instanceof Error ? cause.message : t('admin-media.galleryEditor.loadFailed')
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
    if (
      !ready.value ||
      saving.value ||
      loading.value ||
      !form.title.trim() ||
      (form.source === 'external' ? galleryUrlError(form.externalUrl) : !form.mediaId)
    )
      return
    const user = auth.currentUser.value?.id,
      version = generation,
      capture = JSON.stringify(form)
    const recoveringMatches =
      !pendingCreate.value ||
      JSON.stringify({ ...galleryForm(form), status: pendingCreate.value.status }) ===
        JSON.stringify(pendingCreate.value)
    if (!user || user !== actor || ownedContext !== context.value) {
      ready.value = false
      error.value = t('admin-media.galleryEditor.contextChanged')
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
          if (known.state === 'deleted') throw new Error(t('admin-media.galleryEditor.submissionDeleted'))
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
      const accepted = galleryForm(photo)
      // 另一来源的未提交输入继续保留在表单及恢复副本，不发送给 API。
      if (form.source === accepted.source) {
        if (accepted.source === 'media') accepted.externalUrl = form.externalUrl
        else accepted.mediaId = form.mediaId
      }
      baseline.value = JSON.stringify(galleryForm(photo))
      if (JSON.stringify(form) === capture && recoveringMatches) Object.assign(form, accepted)
      notice.value = dirty.value ? t('admin-media.galleryEditor.verifiedDirty') : t('admin-media.galleryEditor.saved')
      if (!dirty.value) {
        sessionStorage.removeItem(storageKey())
        recovery.value = null
      } else persistLocal()
      void app.runWithContext(() => refreshNuxtData(['gallery-feed', 'gallery-metadata']))
      if (wasNew && !dirty.value) redirect = `/admin/gallery/${photo.id}`
    } catch (cause) {
      if (!owns(user, version)) return
      error.value = cause instanceof Error ? cause.message : t('admin-media.galleryEditor.saveFailed')
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
      if (!id.value && pendingCreate.value) error.value += t('admin-media.galleryEditor.pendingHint')
      persistLocal()
    } finally {
      if (alive && generation === version) saving.value = false
    }
    if (redirect && owns(user, version)) await router.replace(redirect)
  }
  async function reload() {
    if (saving.value || (dirty.value && !window.confirm(t('admin-media.galleryEditor.reloadConfirm')))) return
    persistLocal()
    await load(true)
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value || !ready.value) return
    if (value.context !== ownedContext || (initialId !== null && value.id !== initialId)) {
      error.value = t('admin-media.galleryEditor.recoveryMismatch')
      return
    }
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    pendingCreate.value = value.pendingCreate
    recovery.value = null
    notice.value = t('admin-media.galleryEditor.restored')
  }
  function discardRecovery() {
    try {
      sessionStorage.removeItem(currentRecoveryKey || storageKey())
      recovery.value = null
    } catch {
      localError.value = t('admin-media.galleryEditor.discardFailed')
    }
  }
  function mergeConflict() {
    const latest = serverVersion.value
    if (!latest || saving.value || !ready.value || latest.id !== id.value) return
    revision.value = latest.revision
    saved.value = latest
    baseline.value = JSON.stringify(galleryForm(latest))
    serverVersion.value = null
    notice.value = t('admin-media.galleryEditor.merged')
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
    return window.confirm(t('admin-media.galleryEditor.leaveConfirm'))
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
      error.value = t('admin-media.galleryEditor.contextSwitched')
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
