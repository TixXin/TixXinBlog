/**
 * @file useMediaLibrary.ts
 * @description 媒体工作区的请求、上传队列与草稿保护；展示组件仅通过 props 接收状态和动作。
 */
import type { MediaAsset, MediaReferences } from '~/features/media/types'
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
  const uploader = useMediaUpload()
  const { success } = useToast()
  const route = useRoute()
  const router = useRouter()
  const search = ref(!selectable && typeof route.query.search === 'string' ? route.query.search : '')
  const deleted = ref(!selectable && route.query.deleted === 'true' ? 'true' : 'false')
  const initialPage = Number(route.query.page)
  const page = ref(!selectable && Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1)
  const total = ref(0)
  const items = ref<MediaAsset[]>([])
  const altDrafts = reactive<Record<string, string>>({})
  const savedAlts = reactive<Record<string, string>>({})
  const hasDirtyAlt = computed(() => Object.entries(altDrafts).some(([id, value]) => value !== savedAlts[id]))
  const uploadAlt = ref('')
  const jobs = ref<UploadJob[]>([])
  const pending = ref(false)
  const ready = ref(false)
  const working = ref(false)
  const uploading = ref(false)
  const error = ref('')
  const references = ref<MediaReferences | null>(null)
  const referenceId = ref('')
  let disposed = false
  let requestVersion = 0
  const busy = computed(() => working.value || uploading.value || hasDirtyAlt.value)
  function errorText(cause: unknown) {
    return cause instanceof Error ? cause.message : '操作失败，请重试'
  }
  async function load() {
    const version = ++requestVersion
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: MediaAsset[]; total: number }>('/admin/media', {
        query: { page: page.value, pageSize: 20, search: search.value || undefined, deleted: deleted.value },
      })
      if (version !== requestVersion) return
      items.value = result.items
      ready.value = true
      total.value = result.total
      for (const asset of result.items) {
        if (altDrafts[asset.id] === undefined || altDrafts[asset.id] === savedAlts[asset.id])
          altDrafts[asset.id] = asset.alt
        savedAlts[asset.id] = asset.alt
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
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    }
    const target = router.resolve({ path: '/admin/media', query }).fullPath
    if (target === route.fullPath) return false
    await router.replace({ path: '/admin/media', query })
    return true
  }
  async function searchMedia() {
    if (hasDirtyAlt.value) {
      error.value = '请先保存或取消替代文本修改'
      return
    }
    page.value = 1
    if (!(await syncAddress())) await load()
  }
  async function changePage(value: number) {
    if (hasDirtyAlt.value) {
      error.value = '请先保存或取消替代文本修改'
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
      const value = Number(route.query.page)
      page.value = Number.isSafeInteger(value) && value > 0 ? value : 1
      if (ready.value) void load()
    },
  )
  onBeforeRouteUpdate(() => {
    if (!hasDirtyAlt.value) return true
    if (!window.confirm('替代文本尚未保存，确定放弃修改并切换筛选吗？')) return false
    for (const [id, value] of Object.entries(savedAlts)) altDrafts[id] = value
    return true
  })
  function enqueue(files: File[]) {
    if (hasDirtyAlt.value) {
      error.value = '请先保存或取消替代文本修改'
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
    if (uploading.value || disposed) return
    uploading.value = true
    try {
      for (const job of jobs.value.filter((item) => item.status === 'queued')) {
        if (disposed || !job.file) break
        job.status = 'uploading'
        job.error = ''
        try {
          await uploader.upload(job.file, job.id, job.alt, (value) => {
            job.progress = value
            job.status = value === 100 ? 'processing' : 'uploading'
          })
          job.status = 'done'
          job.file = undefined
        } catch (cause) {
          job.status = 'failed'
          job.error = errorText(cause)
        }
      }
      if (!disposed) {
        page.value = 1
        await load()
      }
    } finally {
      uploading.value = false
    }
  }
  function retry(job: UploadJob) {
    if (!uploading.value) {
      job.status = 'queued'
      job.progress = 0
      void runQueue()
    }
  }
  async function saveAlt(asset: MediaAsset) {
    if (working.value) return
    working.value = true
    try {
      const result = await api<MediaAsset>(`/admin/media/${asset.id}`, {
        method: 'PATCH',
        body: { alt: altDrafts[asset.id] },
      })
      asset.alt = result.alt
      savedAlts[asset.id] = result.alt
      success('替代文本已保存')
    } catch {
      error.value = '替代文本保存失败，输入已保留'
    } finally {
      working.value = false
    }
  }
  async function showReferences(id: string, currentPage = 1) {
    if (working.value) return
    working.value = true
    try {
      referenceId.value = id
      references.value = await api(`/admin/media/${id}/references`, { query: { page: currentPage } })
    } catch {
      error.value = '引用读取失败，请重试'
    } finally {
      working.value = false
    }
  }
  async function remove(asset: MediaAsset) {
    if (working.value) return
    working.value = true
    try {
      const refs = await api<MediaReferences>(`/admin/media/${asset.id}/references`)
      if (refs.total) {
        referenceId.value = asset.id
        references.value = refs
        error.value = '资源仍被引用，不能移除'
        return
      }
      if (!window.confirm('将此图片移入回收？资源链接将不可访问，文件保留，可恢复。')) return
      await api(`/admin/media/${asset.id}`, { method: 'DELETE' })
      success('资源已移入回收')
      await load()
    } catch (cause) {
      error.value = (cause as { data?: { message?: string } }).data?.message ?? '移除失败，请重试'
    } finally {
      working.value = false
    }
  }
  async function restore(asset: MediaAsset) {
    if (working.value) return
    working.value = true
    try {
      await api(`/admin/media/${asset.id}/restore`, { method: 'POST' })
      success('资源已恢复')
      await load()
    } catch {
      error.value = '恢复失败，请检查文件存储后重试'
    } finally {
      working.value = false
    }
  }
  onBeforeRouteLeave(
    () =>
      (!uploading.value && !hasDirtyAlt.value) ||
      window.confirm('仍有上传或未保存的替代文本，离开会停止等待并放弃未保存输入；已上传资源保留。确定离开吗？'),
  )
  onMounted(async () => {
    if (await auth.restore()) await load()
    else if (!selectable) await navigateTo({ path: '/admin/login', query: { next: '/admin/media' } })
    else error.value = '请先登录博主账号，媒体库仅对管理员开放'
  })
  onBeforeUnmount(() => {
    disposed = true
    requestVersion += 1
  })
  return {
    search,
    deleted,
    page,
    total,
    items,
    altDrafts,
    savedAlts,
    hasDirtyAlt,
    uploadAlt,
    jobs,
    pending,
    ready,
    working,
    uploading,
    error,
    references,
    referenceId,
    busy,
    load,
    searchMedia,
    changePage,
    chooseFiles,
    dropFiles,
    retry,
    saveAlt,
    showReferences,
    remove,
    restore,
  }
}
