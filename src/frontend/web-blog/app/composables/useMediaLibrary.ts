/**
 * @file useMediaLibrary.ts
 * @description 媒体工作区的请求、上传队列与草稿保护；展示组件仅通过 props 接收状态和动作。
 */
import type {
  MediaAsset,
  MediaOrientation,
  MediaReferences,
  MediaRemovalResult,
  MediaUsage,
} from '~/features/media/types'
export function useMediaLibrary(selectable = false) {
  interface UploadJob {
    id: string
    name: string
    file?: File
    alt: string
    progress: number
    status: 'queued' | 'uploading' | 'processing' | 'done' | 'failed'
    error: string
  }
  const api = useAdminApi()
  const auth = useCurrentUser()
  const pageContext = useState<string>('page-content-context', () => '')
  const uploader = useMediaUpload()
  const { success } = useToast()
  const route = useRoute()
  const router = useRouter()
  const search = ref(!selectable && typeof route.query.search === 'string' ? route.query.search : '')
  const deleted = ref(!selectable && route.query.deleted === 'true' ? 'true' : 'false')
  const readOrientation = (value: unknown): MediaOrientation =>
    typeof value === 'string' && ['landscape', 'portrait', 'square'].includes(value) ? (value as MediaOrientation) : ''
  const readUsage = (value: unknown): MediaUsage =>
    typeof value === 'string' && ['used', 'unused'].includes(value) ? (value as MediaUsage) : ''
  const orientation = ref<MediaOrientation>(selectable ? '' : readOrientation(route.query.orientation))
  const usage = ref<MediaUsage>(selectable ? '' : readUsage(route.query.usage))
  const initialPage = Number(route.query.page)
  const page = ref(!selectable && Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1)
  const total = ref(0)
  const items = ref<MediaAsset[]>([])
  const altDrafts = reactive<Record<string, string>>({})
  const savedAlts = reactive<Record<string, string>>({})
  const hasDirtyAlt = computed(() => Object.entries(altDrafts).some(([id, value]) => value !== savedAlts[id]))
  const descriptionDrafts = reactive<Record<string, string>>({})
  const savedDescriptions = reactive<Record<string, string>>({})
  const hasDirtyDescription = computed(() =>
    Object.entries(descriptionDrafts).some(([id, value]) => value !== savedDescriptions[id]),
  )
  const hasDirtyMetadata = computed(() => hasDirtyAlt.value || hasDirtyDescription.value)
  const uploadAlt = ref('')
  const jobs = ref<UploadJob[]>([])
  const pending = ref(false)
  const ready = ref(false)
  const working = ref(false)
  const uploading = ref(false)
  const error = ref('')
  const references = ref<MediaReferences | null>(null)
  const referenceId = ref('')
  const referenceLoading = ref(false)
  const referenceError = ref('')
  const selectedIds = ref<string[]>([])
  const batchResults = ref<MediaRemovalResult[]>([])
  const batchProgress = ref<{ completed: number; total: number } | null>(null)
  const referenceName = computed(
    () =>
      items.value.find((asset) => asset.id === referenceId.value)?.name ??
      batchResults.value.find((result) => result.id === referenceId.value)?.name ??
      referenceId.value,
  )
  const selectableItems = computed(() => items.value.filter((asset) => !asset.deleted))
  const allSelected = computed(
    () =>
      selectableItems.value.length > 0 && selectableItems.value.every((asset) => selectedIds.value.includes(asset.id)),
  )
  const someSelected = computed(() => selectedIds.value.length > 0 && !allSelected.value)
  let disposed = false
  let requestVersion = 0
  let ownershipVersion = 0
  let referenceVersion = 0
  let owner: { actor: string; context: string } | null = null
  const busy = computed(
    () => working.value || uploading.value || hasDirtyMetadata.value || jobs.value.some((job) => !!job.file),
  )
  const ownershipMessage =
    '登录账号或内容库已变化，原文件、替代文本和素材说明已保留。恢复原账号及内容库后重新读取，或重新进入媒体工作区。'
  const ownsWorkspace = () =>
    !disposed && owner?.actor === auth.currentUser.value?.id && owner?.context === pageContext.value
  const ownsOperation = (version: number) => ownsWorkspace() && version === ownershipVersion
  const canBatchSelect = computed(
    () => !selectable && deleted.value === 'false' && ready.value && ownsWorkspace() && !pending.value && !busy.value,
  )
  function clearSelection() {
    selectedIds.value = []
  }
  function toggleSelection(asset: MediaAsset) {
    if (!canBatchSelect.value || !allowAction(asset) || asset.deleted) return
    selectedIds.value = selectedIds.value.includes(asset.id)
      ? selectedIds.value.filter((id) => id !== asset.id)
      : [...selectedIds.value, asset.id]
  }
  function toggleAll() {
    if (!canBatchSelect.value || !allowAction()) return
    selectedIds.value = allSelected.value ? [] : selectableItems.value.map((asset) => asset.id)
  }
  function closeReferences() {
    referenceVersion++
    references.value = null
    referenceId.value = ''
    referenceLoading.value = false
    referenceError.value = ''
  }
  function allowAction(asset?: MediaAsset) {
    // 嵌入公开页面时，文件选择器与列表请求同时挂载；未就绪不代表身份已经变化。
    if (!ready.value) {
      if (!error.value) error.value = pending.value ? '媒体库正在读取，请稍候再选择文件。' : '请先读取媒体库后再操作。'
      return false
    }
    if (!ownsWorkspace() || (asset && !items.value.includes(asset))) {
      error.value = ownershipMessage
      return false
    }
    return true
  }
  function canSelect(asset: MediaAsset) {
    return (
      ready.value && ownsWorkspace() && items.value.includes(asset) && !asset.deleted && !pending.value && !busy.value
    )
  }
  watch(
    [() => auth.currentUser.value?.id, () => pageContext.value],
    () => {
      if (!owner || disposed) return
      ownershipVersion++
      requestVersion++
      ready.value = false
      pending.value = false
      items.value = []
      total.value = 0
      closeReferences()
      clearSelection()
      batchResults.value = []
      batchProgress.value = null
      error.value = ownershipMessage
      uploader.cancel()
      for (const job of jobs.value) {
        if (job.file && ['queued', 'uploading', 'processing'].includes(job.status)) {
          job.status = 'failed'
          job.error = ownershipMessage
        }
      }
    },
    { flush: 'sync' },
  )
  function errorText(cause: unknown) {
    return cause instanceof Error ? cause.message : '操作失败，请重试'
  }
  async function load() {
    if (disposed) return
    clearSelection()
    const actor = auth.currentUser.value?.id
    if (!actor) {
      ready.value = false
      error.value = '请先登录博主账号，媒体库仅对管理员开放'
      return
    }
    owner ??= { actor, context: pageContext.value }
    if (!ownsWorkspace()) {
      ready.value = false
      error.value = ownershipMessage
      return
    }
    const version = ++requestVersion
    const operation = ownershipVersion
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: MediaAsset[]; total: number }>('/admin/media', {
        query: {
          page: page.value,
          pageSize: 20,
          search: search.value || undefined,
          deleted: deleted.value,
          orientation: orientation.value || undefined,
          usage: usage.value || undefined,
        },
      })
      if (version !== requestVersion || !ownsOperation(operation)) return
      items.value = result.items
      ready.value = true
      error.value = ''
      total.value = result.total
      for (const asset of result.items) {
        if (altDrafts[asset.id] === undefined || altDrafts[asset.id] === savedAlts[asset.id])
          altDrafts[asset.id] = asset.alt
        savedAlts[asset.id] = asset.alt
        if (descriptionDrafts[asset.id] === undefined || descriptionDrafts[asset.id] === savedDescriptions[asset.id])
          descriptionDrafts[asset.id] = asset.description ?? ''
        savedDescriptions[asset.id] = asset.description ?? ''
      }
      const last = Math.max(1, Math.ceil(total.value / 20))
      if (page.value > last) {
        page.value = last
        await load()
      }
    } catch {
      if (version === requestVersion) error.value = '媒体读取失败，请检查登录或重试'
    } finally {
      if (version === requestVersion) pending.value = false
    }
  }
  async function syncAddress() {
    if (selectable) return false
    const query = {
      ...(search.value ? { search: search.value } : {}),
      ...(deleted.value === 'true' ? { deleted: 'true' } : {}),
      ...(orientation.value ? { orientation: orientation.value } : {}),
      ...(usage.value ? { usage: usage.value } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    }
    const target = router.resolve({ path: '/admin/media', query }).fullPath
    if (target === route.fullPath) return false
    await router.replace({ path: '/admin/media', query })
    return true
  }
  async function searchMedia() {
    if (working.value || uploading.value || pending.value || !allowAction()) return
    if (hasDirtyMetadata.value) {
      error.value = '请先保存或取消替代文本和素材说明修改'
      return
    }
    page.value = 1
    if (!(await syncAddress())) await load()
  }
  async function changePage(value: number) {
    if (working.value || uploading.value || pending.value || !allowAction()) return
    if (hasDirtyMetadata.value) {
      error.value = '请先保存或取消替代文本和素材说明修改'
      return
    }
    page.value = value
    if (!(await syncAddress())) await load()
  }
  watch(
    () => route.query,
    () => {
      if (selectable || route.path !== '/admin/media') return
      search.value = typeof route.query.search === 'string' ? route.query.search : ''
      deleted.value = route.query.deleted === 'true' ? 'true' : 'false'
      orientation.value = readOrientation(route.query.orientation)
      usage.value = readUsage(route.query.usage)
      const value = Number(route.query.page)
      page.value = Number.isSafeInteger(value) && value > 0 ? value : 1
      if (ready.value) void load()
    },
  )
  onBeforeRouteUpdate(() => {
    if (working.value || uploading.value) return false
    if (!hasDirtyMetadata.value) return true
    if (!window.confirm('替代文本或素材说明尚未保存，确定放弃修改并切换筛选吗？')) return false
    for (const [id, value] of Object.entries(savedAlts)) altDrafts[id] = value
    for (const [id, value] of Object.entries(savedDescriptions)) descriptionDrafts[id] = value
    return true
  })
  function enqueue(files: File[]) {
    if (!allowAction() || uploading.value || working.value) return
    if (hasDirtyMetadata.value) {
      error.value = '请先保存或取消替代文本和素材说明修改'
      return
    }
    if (files.length > 10) {
      error.value = '每次最多选择 10 张图片'
      return
    }
    for (const file of files) {
      const valid = file.size <= 8 * 1024 * 1024 && /\.(jpe?g|png|webp)$/i.test(file.name)
      jobs.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        file: valid ? markRaw(file) : undefined,
        alt: uploadAlt.value,
        progress: 0,
        status: valid ? 'queued' : 'failed',
        error: valid ? '' : '请选择不超过 8MB 的 JPEG、PNG 或 WebP',
      })
    }
    void runQueue()
  }
  function chooseFiles(event: Event) {
    const input = event.target as HTMLInputElement
    enqueue(Array.from(input.files ?? []))
    input.value = ''
  }
  function dropFiles(event: DragEvent) {
    if (!uploading.value) enqueue(Array.from(event.dataTransfer?.files ?? []))
  }
  async function runQueue() {
    if (uploading.value || !allowAction()) return
    const operation = ownershipVersion
    uploading.value = true
    try {
      for (const job of jobs.value.filter((item) => item.status === 'queued')) {
        if (!ownsOperation(operation) || !job.file) break
        job.status = 'uploading'
        job.error = ''
        try {
          await uploader.upload(job.file, job.id, job.alt, (value) => {
            if (!ownsOperation(operation)) return
            job.progress = value
            job.status = value === 100 ? 'processing' : 'uploading'
          })
          if (!ownsOperation(operation)) break
          job.status = 'done'
          job.file = undefined
        } catch (cause) {
          if (!ownsOperation(operation)) break
          job.status = 'failed'
          job.error = errorText(cause)
        }
      }
      if (ownsOperation(operation)) {
        page.value = 1
        await load()
      }
    } finally {
      uploading.value = false
    }
  }
  function retry(job: UploadJob) {
    if (allowAction() && jobs.value.includes(job) && job.file && !uploading.value) {
      job.status = 'queued'
      job.progress = 0
      void runQueue()
    }
  }
  async function saveField(asset: MediaAsset, field: 'alt' | 'description') {
    if (working.value || !allowAction(asset)) return
    const operation = ownershipVersion
    const drafts = field === 'alt' ? altDrafts : descriptionDrafts
    const saved = field === 'alt' ? savedAlts : savedDescriptions
    const submitted = drafts[asset.id] ?? ''
    const label = field === 'alt' ? '替代文本' : '素材说明'
    working.value = true
    error.value = ''
    try {
      const result = await api<MediaAsset>(`/admin/media/${asset.id}`, {
        method: 'PATCH',
        body: { [field]: submitted },
      })
      if (!ownsOperation(operation)) return
      const value = result[field] ?? ''
      const current = items.value.find((item) => item.id === asset.id)
      if (current) current[field] = value
      saved[asset.id] = value
      if (drafts[asset.id] === submitted) drafts[asset.id] = value
      success(`${label}已保存`)
    } catch {
      if (ownsOperation(operation)) error.value = `${label}保存失败，输入已保留`
    } finally {
      working.value = false
    }
  }
  const saveAlt = (asset: MediaAsset) => saveField(asset, 'alt')
  const saveDescription = (asset: MediaAsset) => saveField(asset, 'description')
  async function showReferences(id: string, currentPage = 1) {
    if (
      working.value ||
      !allowAction() ||
      !Number.isSafeInteger(currentPage) ||
      currentPage < 1 ||
      (!items.value.some((asset) => asset.id === id) && !batchResults.value.some((result) => result.id === id))
    )
      return
    const operation = ownershipVersion
    const version = ++referenceVersion
    referenceId.value = id
    references.value = null
    referenceError.value = ''
    referenceLoading.value = true
    try {
      const result = await api<MediaReferences>(`/admin/media/${id}/references`, { query: { page: currentPage } })
      if (ownsOperation(operation) && version === referenceVersion) references.value = result
    } catch {
      if (ownsOperation(operation) && version === referenceVersion) referenceError.value = '引用读取失败，请重试'
    } finally {
      if (version === referenceVersion) referenceLoading.value = false
    }
  }
  function referencedResult(asset: MediaAsset, refs: MediaReferences): MediaRemovalResult {
    return {
      id: asset.id,
      name: asset.name,
      status: 'referenced',
      message: `仍有 ${refs.total} 处引用（含历史修订），未移入回收`,
      references: refs,
    }
  }
  async function removeBatchAsset(asset: MediaAsset, operation: number): Promise<MediaRemovalResult | undefined> {
    let checked = false
    try {
      const refs = await api<MediaReferences>(`/admin/media/${asset.id}/references`)
      if (!ownsOperation(operation)) return
      if (refs.total) return referencedResult(asset, refs)
      checked = true
      // 预检只用于说明；最终是否可删仍由后端在共享媒体锁内重新检查。
      await api(`/admin/media/${asset.id}`, { method: 'DELETE' })
      if (!ownsOperation(operation)) return
      return { id: asset.id, name: asset.name, status: 'removed', message: '已移入回收，可恢复' }
    } catch (cause) {
      if (!ownsOperation(operation)) return
      if (checked) {
        try {
          const refs = await api<MediaReferences>(`/admin/media/${asset.id}/references`)
          if (!ownsOperation(operation)) return
          if (refs.total) return referencedResult(asset, refs)
        } catch {
          if (!ownsOperation(operation)) return
          // 删除失败后的补查也可能失败；保留失败结果，不推断无引用或自动重试删除。
        }
      }
      const message = (cause as { data?: { message?: string } } | null)?.data?.message ?? errorText(cause)
      return {
        id: asset.id,
        name: asset.name,
        status: 'failed',
        message: checked ? `${message}；请重新读取核对回收状态` : `引用检查失败，未执行删除：${message}`,
      }
    }
  }
  async function removeSelected() {
    if (!canBatchSelect.value || !allowAction()) return
    const selected = selectableItems.value.filter((asset) => selectedIds.value.includes(asset.id))
    if (!selected.length) return
    const operation = ownershipVersion
    if (
      !window.confirm(
        `将所选 ${selected.length} 张图片中未被引用的资源移入回收？被引用的资源会保留并列出引用位置。回收后链接不可访问，文件保留，可恢复。`,
      ) ||
      !ownsOperation(operation) ||
      !canBatchSelect.value
    )
      return
    working.value = true
    error.value = ''
    closeReferences()
    batchResults.value = []
    batchProgress.value = { completed: 0, total: selected.length }
    try {
      for (const asset of selected) {
        if (!ownsOperation(operation)) break
        const result = await removeBatchAsset(asset, operation)
        if (!result || !ownsOperation(operation)) break
        batchResults.value.push(result)
        batchProgress.value = { completed: batchResults.value.length, total: selected.length }
      }
      if (!ownsOperation(operation)) return
      const removed = batchResults.value.filter((result) => result.status === 'removed').length
      if (removed) success(`已将 ${removed} 张图片移入回收`)
      await load()
    } finally {
      working.value = false
      batchProgress.value = null
    }
  }
  async function remove(asset: MediaAsset) {
    if (working.value || !allowAction(asset)) return
    const operation = ownershipVersion
    working.value = true
    try {
      const refs = await api<MediaReferences>(`/admin/media/${asset.id}/references`)
      if (!ownsOperation(operation)) return
      if (refs.total) {
        closeReferences()
        referenceId.value = asset.id
        references.value = refs
        error.value = '资源仍被引用，不能移除'
        return
      }
      if (!window.confirm('将此图片移入回收？资源链接将不可访问，文件保留，可恢复。')) return
      if (!ownsOperation(operation)) return
      await api(`/admin/media/${asset.id}`, { method: 'DELETE' })
      if (!ownsOperation(operation)) return
      success('资源已移入回收')
      await load()
    } catch (cause) {
      if (ownsOperation(operation))
        error.value = (cause as { data?: { message?: string } }).data?.message ?? '移除失败，请重试'
    } finally {
      working.value = false
    }
  }
  async function restore(asset: MediaAsset) {
    if (working.value || !allowAction(asset)) return
    const operation = ownershipVersion
    working.value = true
    try {
      await api(`/admin/media/${asset.id}/restore`, { method: 'POST' })
      if (!ownsOperation(operation)) return
      success('资源已恢复')
      await load()
    } catch {
      if (ownsOperation(operation)) error.value = '恢复失败，请检查文件存储后重试'
    } finally {
      working.value = false
    }
  }
  onBeforeRouteLeave(
    () =>
      !busy.value ||
      window.confirm(
        batchProgress.value
          ? '批量回收仍在进行，离开后停止后续操作；已发出的删除请求可能已经生效。请返回媒体库重新读取核对结果。确定离开吗？'
          : '仍有上传或未保存的替代文本、素材说明，离开会停止等待并放弃未保存输入；已上传资源保留。确定离开吗？',
      ),
  )
  function beforeUnload(event: BeforeUnloadEvent) {
    if (busy.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(async () => {
    window.addEventListener('beforeunload', beforeUnload)
    const actor = auth.currentUser.value?.id
    const context = pageContext.value
    const restored = await auth.restore()
    if (disposed) return
    if ((actor && auth.currentUser.value?.id !== actor) || pageContext.value !== context) {
      error.value = ownershipMessage
      return
    }
    if (restored) await load()
    else if (!selectable) await navigateTo({ path: '/admin/login', query: { next: '/admin/media' } })
    else error.value = '请先登录博主账号，媒体库仅对管理员开放'
  })
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnload)
    disposed = true
    requestVersion += 1
    ownershipVersion += 1
    uploader.cancel()
  })
  return {
    search,
    deleted,
    orientation,
    usage,
    page,
    total,
    items,
    altDrafts,
    savedAlts,
    hasDirtyAlt,
    descriptionDrafts,
    savedDescriptions,
    hasDirtyDescription,
    hasDirtyMetadata,
    uploadAlt,
    jobs,
    pending,
    ready,
    working,
    uploading,
    error,
    references,
    referenceId,
    referenceName,
    referenceLoading,
    referenceError,
    closeReferences,
    selectedIds,
    allSelected,
    someSelected,
    canBatchSelect,
    toggleSelection,
    toggleAll,
    clearSelection,
    removeSelected,
    batchResults,
    batchProgress,
    busy,
    canSelect,
    load,
    searchMedia,
    changePage,
    chooseFiles,
    dropFiles,
    retry,
    saveAlt,
    saveDescription,
    showReferences,
    remove,
    restore,
  }
}
