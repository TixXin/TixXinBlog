/**
 * @file useContentBackup.ts
 * @description 内容包下载、文件预览与幂等导入；失败保留本地文件，状态以服务器为准。
 */
import type { ContentImportView } from '~/features/backup/types'
export function useContentBackup() {
  const auth = useCurrentUser()
  const api = useAdminApi()
  const site = useSiteSettings()
  const pageContext = useState<string>('page-content-context', () => '')
  const route = useRoute()
  const toast = useToast()
  const pending = ref(false)
  const error = ref('')
  const mediaIncluded = ref(true)
  const file = shallowRef<File | null>(null)
  const strategy = ref<'skip' | 'copy'>('skip')
  const includeSettings = ref(false)
  const requestId = ref('')
  const job = ref<ContentImportView | null>(null)
  const acknowledgement = ref('')
  const recent = ref<{ ticket: string; createdAt: string; completed: boolean; expired: boolean }[]>([])
  const recentError = ref('')
  const headers = () => ({
    ...(auth.accessToken.value ? { Authorization: `Bearer ${auth.accessToken.value}` } : {}),
    ...(pageContext.value ? { 'X-Content-Context': pageContext.value } : {}),
  })
  function detail(cause: unknown, fallback: string) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    return typeof message === 'string' ? message : fallback
  }
  async function authenticated<T>(send: () => Promise<T>): Promise<T> {
    if (!(await auth.restore())) throw new Error('请重新登录后重试')
    try {
      return await send()
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode === 401 && (await auth.refresh())) return send()
      throw cause
    }
  }
  async function exportPackage() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      const response = await authenticated(() =>
        $fetch.raw<Blob>('/api/v1/admin/backup/export', {
          method: 'POST',
          body: { mediaIncluded: mediaIncluded.value },
          headers: headers(),
          credentials: 'include',
          responseType: 'blob',
          retry: 0,
          timeout: 120000,
        }),
      )
      if (!response._data) throw new Error('下载内容为空')
      const url = URL.createObjectURL(response._data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'tixxin-content.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('内容包下载已开始')
    } catch (cause) {
      const blob = (cause as { data?: unknown }).data
      if (blob instanceof Blob) {
        try {
          error.value = JSON.parse(await blob.text()).message || '内容包下载失败'
        } catch {
          error.value = '内容包下载失败，请检查登录或服务状态'
        }
      } else error.value = detail(cause, '内容包下载失败，请检查登录或服务状态')
    } finally {
      pending.value = false
    }
  }
  function choose(selected: File | null) {
    if (pending.value) return
    if (selected && (selected.size > 50 * 1024 * 1024 || !selected.name.toLowerCase().endsWith('.json'))) {
      error.value = '请选择不超过 50MB 的 JSON 内容包'
      return
    }
    file.value = selected
    requestId.value = selected ? crypto.randomUUID() : ''
    job.value = null
    acknowledgement.value = ''
    error.value = ''
  }
  watch([strategy, includeSettings], () => {
    if (file.value) {
      requestId.value = crypto.randomUUID()
      job.value = null
      acknowledgement.value = ''
    }
  })
  async function loadRecent() {
    recentError.value = ''
    try {
      recent.value = await api('/admin/backup/imports')
    } catch {
      recentError.value = '导入记录读取失败'
    }
  }
  async function accept(value: ContentImportView) {
    job.value = value
    if (value.completed && value.result?.settings) await site.refresh()
    await loadRecent()
  }
  async function preview() {
    if (pending.value || !file.value) return
    pending.value = true
    error.value = ''
    try {
      const form = new FormData()
      form.append('file', file.value, file.value.name)
      form.append('requestId', requestId.value)
      form.append('strategy', strategy.value)
      form.append('includeSettings', String(includeSettings.value))
      const value = await authenticated(() =>
        $fetch<{ data: ContentImportView }>('/api/v1/admin/backup/imports/preview', {
          method: 'POST',
          body: form,
          headers: headers(),
          credentials: 'include',
          retry: 0,
          timeout: 120000,
        }),
      )
      acknowledgement.value = ''
      await accept(value.data)
    } catch (cause) {
      error.value = detail(cause, '预览未能确认，文件仍保留；可重试或查询本次上传票据')
    } finally {
      pending.value = false
    }
  }
  async function read(ticket = job.value?.ticket || requestId.value) {
    if (!ticket || pending.value) return
    pending.value = true
    error.value = ''
    try {
      await accept(await api<ContentImportView>(`/admin/backup/imports/${ticket}`))
    } catch (cause) {
      error.value = detail(cause, '票据读取失败，请稍后重试')
    } finally {
      pending.value = false
    }
  }
  async function repreview() {
    if (!job.value || pending.value) return
    pending.value = true
    error.value = ''
    acknowledgement.value = ''
    try {
      await accept(
        await api<ContentImportView>(`/admin/backup/imports/${job.value.ticket}/repreview`, {
          method: 'POST',
          timeout: 120000,
        }),
      )
    } catch (cause) {
      error.value = detail(cause, '重新预览失败，请稍后重试')
    } finally {
      pending.value = false
    }
  }
  async function execute() {
    if (!job.value || pending.value || acknowledgement.value !== '导入为新草稿') return
    pending.value = true
    error.value = ''
    try {
      await accept(
        await api<ContentImportView>(`/admin/backup/imports/${job.value.ticket}/execute`, {
          method: 'POST',
          body: { acknowledgement: acknowledgement.value, confirmation: job.value.confirmation },
          timeout: 120000,
        }),
      )
      if (job.value?.completed) {
        toast.success('内容已迁入为新草稿')
        clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
      }
    } catch (cause) {
      error.value = detail(cause, '导入结果未能确认，请查询同一票据；重复执行不会再次创建已完成内容')
    } finally {
      pending.value = false
    }
  }
  onMounted(async () => {
    if (!(await auth.restore())) {
      await navigateTo('/admin/login?next=/admin/maintenance')
      return
    }
    await loadRecent()
    if (typeof route.query.import === 'string' && /^[a-f0-9-]{36}$/.test(route.query.import))
      await read(route.query.import)
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (pending.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  onBeforeRouteLeave(
    () => !pending.value || window.confirm('请求仍在处理中，离开后可通过导入票据查询结果。确定离开吗？'),
  )
  return {
    pending,
    error,
    mediaIncluded,
    file,
    strategy,
    includeSettings,
    requestId,
    job,
    acknowledgement,
    recent,
    recentError,
    exportPackage,
    choose,
    preview,
    read,
    repreview,
    execute,
    loadRecent,
  }
}
