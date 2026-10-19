/**
 * @file useContentBackup.ts
 * @description 内容包下载与幂等导入绑定发起账号、内容库和提交快照；身份变化后保留原文件与票据。
 */
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { IMPORT_ACKNOWLEDGEMENT, type ContentImportView } from '~/features/backup/types'
import { apiErrorMessage } from '~/utils/apiError'
interface BackupOwner {
  actor?: string
  context: string
  generation: number
}
interface BackupSelection {
  file: File | null
  requestId: string
  strategy: 'skip' | 'copy'
  includeSettings: boolean
}
export function useContentBackup() {
  const app = useNuxtApp()
  const auth = useCurrentUser()
  const api = useAdminApi()
  const site = useSiteSettings()
  const pageContext = useState<string>('page-content-context', () => '')
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()
  const pending = ref(false)
  // 只有上传、执行、重新预览和下载这类有副作用的请求需要离开确认；只读的票据查询随时可以离开
  const guarded = ref(false)
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
  const selections = new Map<string, BackupSelection>()
  let alive = true,
    generation = 0,
    operation = 0,
    recentVersion = 0,
    changingActor = false,
    identityInitialized = !!auth.currentUser.value,
    selectionActor = auth.currentUser.value?.id,
    jobOwner: BackupOwner | null = null
  // 每次取用时按当前界面语言生成，切换语言后提示随之更新。
  const ownershipMessage = () => t('admin-system.backup.ownershipChanged')
  const captureOwner = (): BackupOwner => ({
    actor: auth.currentUser.value?.id,
    context: pageContext.value,
    generation,
  })
  const owns = (owner: BackupOwner) =>
    alive &&
    owner.generation === generation &&
    owner.actor === auth.currentUser.value?.id &&
    owner.context === pageContext.value
  const ownershipError = () => Object.assign(new Error(ownershipMessage()), { statusCode: 409, ownershipChanged: true })
  function assertOwner(owner: BackupOwner) {
    if (!owns(owner)) throw ownershipError()
  }
  function detail(cause: unknown, fallbackKey: string) {
    if ((cause as { ownershipChanged?: boolean })?.ownershipChanged) return ownershipMessage()
    return apiErrorMessage(cause, fallbackKey, { t })
  }
  async function authenticated<T>(
    owner: BackupOwner,
    send: (headers: Record<string, string>) => Promise<T>,
    refreshUnauthorized = true,
  ): Promise<T> {
    const restored = await auth.restore()
    const actor = auth.currentUser.value?.id
    if (
      !alive ||
      pageContext.value !== owner.context ||
      (owner.actor && (actor !== owner.actor || generation !== owner.generation))
    )
      throw ownershipError()
    if (!restored || !actor) throw new Error('请重新登录后重试')
    // 初次恢复身份可以绑定刚确认的账号；已有身份的请求禁止跨账号或跨代次继续。
    owner.actor = actor
    owner.generation = generation
    const attempt = async () => {
      assertOwner(owner)
      const value = await send({
        ...(auth.accessToken.value ? { Authorization: `Bearer ${auth.accessToken.value}` } : {}),
        ...(owner.context ? { 'X-Content-Context': owner.context } : {}),
      })
      assertOwner(owner)
      return value
    }
    try {
      return await attempt()
    } catch (cause) {
      if (refreshUnauthorized && (cause as { statusCode?: number })?.statusCode === 401) {
        assertOwner(owner)
        const refreshed = await auth.refresh()
        assertOwner(owner)
        if (refreshed) return attempt()
      }
      throw cause
    }
  }
  function begin(sideEffect = true) {
    pending.value = true
    guarded.value = sideEffect
    error.value = ''
    return { owner: captureOwner(), version: ++operation }
  }
  async function fail(cause: unknown, fallbackKey: string, owner: BackupOwner, version: number) {
    let message = detail(cause, fallbackKey)
    const blob = (cause as { data?: unknown })?.data
    if (blob instanceof Blob && owns(owner)) {
      try {
        const parsed = JSON.parse(await blob.text()) as { message?: unknown }
        if (typeof parsed.message === 'string') message = parsed.message
      } catch {
        /* Blob 错误无法解码时使用固定提示，保留文件及票据。 */
      }
    }
    if (alive && version === operation) error.value = owns(owner) ? message : ownershipMessage()
  }
  function finish(version: number) {
    if (alive && version === operation) pending.value = guarded.value = false
  }
  async function exportPackage() {
    if (pending.value) return
    const { owner, version } = begin()
    const body = { mediaIncluded: mediaIncluded.value }
    try {
      const response = await authenticated(owner, (headers) =>
        $fetch.raw<Blob>('/api/v1/admin/backup/export', {
          method: 'POST',
          body,
          headers,
          credentials: 'include',
          responseType: 'blob',
          retry: 0,
          timeout: 120000,
        }),
      )
      assertOwner(owner)
      if (!response._data) throw new Error('下载内容为空')
      const url = URL.createObjectURL(response._data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download =
        /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'blog-content.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(t('admin-system.backup.downloadStarted'))
    } catch (cause) {
      await fail(cause, 'admin-system.backup.exportFailed', owner, version)
    } finally {
      finish(version)
    }
  }
  function choose(selected: File | null) {
    if (pending.value) return
    if (selected && (selected.size > 50 * 1024 * 1024 || !selected.name.toLowerCase().endsWith('.json'))) {
      error.value = t('admin-system.backup.fileInvalid')
      return
    }
    file.value = selected
    selectionActor = auth.currentUser.value?.id
    requestId.value = selected ? crypto.randomUUID() : ''
    job.value = null
    jobOwner = null
    acknowledgement.value = ''
    error.value = ''
  }
  watch(
    [strategy, includeSettings],
    () => {
      if (!changingActor && file.value) {
        requestId.value = crypto.randomUUID()
        job.value = null
        jobOwner = null
        acknowledgement.value = ''
      }
    },
    { flush: 'sync' },
  )
  async function loadRecentFor(owner: BackupOwner) {
    const version = ++recentVersion
    recentError.value = ''
    try {
      const values = await authenticated(owner, () => api<typeof recent.value>('/admin/backup/imports'), false)
      if (version === recentVersion && owns(owner)) recent.value = values
    } catch {
      if (alive && version === recentVersion && owns(owner)) recentError.value = t('admin-system.backup.recentFailed')
    }
  }
  function loadRecent() {
    return loadRecentFor(captureOwner())
  }
  async function accept(value: ContentImportView, owner: BackupOwner) {
    assertOwner(owner)
    // 执行响应丢失后查询同一票据，也必须撤销导入前的公开数据。
    if (value.completed) invalidatePublicReads(app)
    job.value = value
    jobOwner = { ...owner }
    if (value.completed && value.result?.settings) {
      await site.refresh()
      assertOwner(owner)
    }
    await loadRecentFor(owner)
    assertOwner(owner)
  }
  async function preview() {
    if (pending.value || !file.value) return
    const { owner, version } = begin()
    const selected = file.value,
      ticket = requestId.value,
      selectedStrategy = strategy.value,
      settings = includeSettings.value
    // File/Blob 保持原对象，FormData 在发起时组装一次；重试不再读取正在变化的表单。
    const form = new FormData()
    form.append('file', selected, selected.name)
    form.append('requestId', ticket)
    form.append('strategy', selectedStrategy)
    form.append('includeSettings', String(settings))
    try {
      const value = await authenticated(owner, (headers) =>
        $fetch<{ data: ContentImportView }>('/api/v1/admin/backup/imports/preview', {
          method: 'POST',
          body: form,
          headers,
          credentials: 'include',
          retry: 0,
          timeout: 120000,
        }),
      )
      assertOwner(owner)
      if (requestId.value !== ticket || file.value !== selected)
        throw new Error('导入选项已变化，请查询原票据后重新核对')
      acknowledgement.value = ''
      await accept(value.data, owner)
    } catch (cause) {
      await fail(cause, 'admin-system.backup.previewFailed', owner, version)
    } finally {
      finish(version)
    }
  }
  async function read(ticket = job.value?.ticket || requestId.value) {
    if (!ticket || pending.value) return
    const { owner, version } = begin(false)
    try {
      await accept(
        await authenticated(owner, () => api<ContentImportView>(`/admin/backup/imports/${ticket}`), false),
        owner,
      )
    } catch (cause) {
      await fail(cause, 'admin-system.backup.readFailed', owner, version)
    } finally {
      finish(version)
    }
  }
  async function repreview() {
    if (!job.value || pending.value || !jobOwner) return
    const ticket = job.value.ticket,
      expected = jobOwner
    const { owner, version } = begin()
    acknowledgement.value = ''
    try {
      assertOwner(expected)
      await accept(
        await authenticated(
          owner,
          () =>
            api<ContentImportView>(`/admin/backup/imports/${ticket}/repreview`, {
              method: 'POST',
              timeout: 120000,
            }),
          false,
        ),
        owner,
      )
    } catch (cause) {
      await fail(cause, 'admin-system.backup.repreviewFailed', owner, version)
    } finally {
      finish(version)
    }
  }
  async function execute() {
    if (!job.value || pending.value || !jobOwner || acknowledgement.value !== IMPORT_ACKNOWLEDGEMENT) return
    const ticket = job.value.ticket,
      expected = jobOwner
    const body = { acknowledgement: acknowledgement.value, confirmation: job.value.confirmation }
    const { owner, version } = begin()
    try {
      assertOwner(expected)
      await accept(
        await authenticated(
          owner,
          () =>
            api<ContentImportView>(`/admin/backup/imports/${ticket}/execute`, {
              method: 'POST',
              body,
              timeout: 120000,
            }),
          false,
        ),
        owner,
      )
      assertOwner(owner)
      if (job.value?.completed) {
        toast.success(t('admin-system.backup.executeSucceeded'))
        clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
      }
    } catch (cause) {
      await fail(cause, 'admin-system.backup.executeFailed', owner, version)
    } finally {
      finish(version)
    }
  }
  watch(
    [() => auth.currentUser.value?.id, pageContext],
    ([actor, context], [previousActor, previousContext]) => {
      const initialRestore = !identityInitialized && !previousActor && !!actor
      identityInitialized ||= !!actor
      if (actor !== previousActor && previousActor) {
        selections.set(previousActor, {
          file: file.value,
          requestId: requestId.value,
          strategy: strategy.value,
          includeSettings: includeSettings.value,
        })
      }
      if (!initialRestore) generation++
      recentVersion++
      if (!initialRestore) pending.value = guarded.value = false
      job.value = null
      jobOwner = null
      acknowledgement.value = ''
      recent.value = []
      recentError.value = ''
      if (actor !== previousActor) {
        const prior = actor ? selections.get(actor) : undefined
        changingActor = true
        if (!(initialRestore && file.value && !selectionActor)) {
          file.value = prior?.file ?? null
          requestId.value = prior?.requestId ?? ''
          strategy.value = prior?.strategy ?? 'skip'
          includeSettings.value = prior?.includeSettings ?? false
        }
        selectionActor = actor
        changingActor = false
      }
      if (previousActor || context !== previousContext) error.value = ownershipMessage()
    },
    { flush: 'sync' },
  )
  onMounted(async () => {
    if (!(await auth.restore())) {
      if (alive) await navigateTo('/admin/login?next=/admin/maintenance')
      return
    }
    if (!alive) return
    const owner = captureOwner()
    await loadRecentFor(owner)
    if (owns(owner) && typeof route.query.import === 'string' && /^[a-f0-9-]{36}$/.test(route.query.import))
      await read(route.query.import)
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (guarded.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => {
    alive = false
    generation++
    recentVersion++
    window.removeEventListener('beforeunload', beforeUnload)
  })
  onBeforeRouteLeave(() => !guarded.value || window.confirm(t('admin-system.backup.leaveConfirm')))
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
