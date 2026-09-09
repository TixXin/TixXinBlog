/** @file useAdminMomentEditor.ts @description 动态编辑、版本冲突与本标签页输入恢复，未知保存结果复用原提交标识 */
import type { ManagedMoment, MomentEditable, MomentStatus } from '~/features/moment/types'
import { momentForm, parseMomentRecovery } from '~/features/moment/editor'
import type { MomentRecovery } from '~/features/moment/editor'
import { fetchPostPage } from '~/features/post/api'

export function useAdminMomentEditor(initialId: string | null) {
  const app = useNuxtApp(),
    router = useRouter()
  const repo = useMomentRepository(),
    store = useMomentStore(),
    auth = useCurrentUser()
  const apiBase = String(useRuntimeConfig().public.apiBaseUrl)
  const articleChoices = ref<{ id: number; title: string }[]>([]),
    articlesPending = ref(false),
    articlesError = ref('')
  let articleVersion = 0
  let articleTimer: ReturnType<typeof setTimeout> | undefined
  let articleController: AbortController | undefined
  function searchArticles(query: string) {
    const current = ++articleVersion
    if (articleTimer) clearTimeout(articleTimer)
    articleController?.abort()
    articlesPending.value = true
    articlesError.value = ''
    articleTimer = setTimeout(() => void fetchArticles(query, current), 250)
  }
  async function fetchArticles(query: string, current: number) {
    articleController = new AbortController()
    try {
      const result = await fetchPostPage(
        apiBase,
        { search: query.slice(0, 200), pageSize: 20 },
        articleController.signal,
      )
      if (!alive || current !== articleVersion) return
      const retained = articleChoices.value.filter(
        (item) => item.id === form.linkedArticleId && !result.items.some((post) => post.id === item.id),
      )
      articleChoices.value = [...retained, ...result.items.map((item) => ({ id: item.id, title: item.title }))]
    } catch {
      if (alive && current === articleVersion) articlesError.value = '文章搜索暂时不可用，请重试。'
    } finally {
      if (alive && current === articleVersion) articlesPending.value = false
    }
  }
  const form = reactive(momentForm())
  const id = ref(initialId),
    revision = ref<number | null>(null),
    saved = ref<ManagedMoment | null>(null)
  const serverVersion = ref<ManagedMoment | null>(null)
  const baseline = ref(JSON.stringify(form))
  const dirty = computed(() => JSON.stringify(form) !== baseline.value)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false)
  const error = ref(''),
    notice = ref(''),
    localError = ref('')
  const recovery = ref<MomentRecovery | null>(null)
  let actor = '',
    requestId = '',
    version = 0,
    alive = true
  const key = () => `tixxin-moment-editor:${actor}:${initialId ?? 'new'}`
  function persistLocal() {
    if (!import.meta.client || !actor || !dirty.value) return
    try {
      const value: MomentRecovery = {
        version: 1,
        id: id.value,
        revision: revision.value,
        requestId,
        form: JSON.parse(JSON.stringify(form)) as MomentEditable,
        savedAt: new Date().toISOString(),
      }
      sessionStorage.setItem(key(), JSON.stringify(value))
      localError.value = ''
    } catch {
      localError.value = '本标签页恢复副本暂时无法保存，请保留当前输入。'
    }
  }
  function accept(note: ManagedMoment) {
    saved.value = note
    id.value = note.id
    revision.value = note.revision
    Object.assign(form, momentForm(note))
    baseline.value = JSON.stringify(form)
    if (note.linkedArticleId)
      articleChoices.value = [
        { id: note.linkedArticleId, title: note.linkedArticle?.title ?? '此前引用的文章（当前未公开）' },
      ]
  }
  async function load() {
    const current = ++version
    loading.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error('请先使用博主账号登录，当前输入会保留。')
      const user = auth.currentUser.value!.id
      if (actor && actor !== user) {
        persistLocal()
        Object.assign(form, momentForm())
        baseline.value = JSON.stringify(form)
      }
      actor = user
      requestId ||= crypto.randomUUID()
      const note = id.value ? await repo.adminDetail(id.value) : null
      if (!alive || current !== version || auth.currentUser.value?.id !== user) return
      if (note) accept(note)
      ready.value = true
      try {
        recovery.value = parseMomentRecovery(sessionStorage.getItem(key()))
      } catch {
        localError.value = '无法读取本标签页恢复副本。'
      }
    } catch (cause) {
      if (current === version && alive) error.value = cause instanceof Error ? cause.message : '动态读取失败，请重试'
    } finally {
      if (current === version && alive) loading.value = false
    }
  }
  function change(value: Partial<MomentEditable>) {
    Object.assign(form, value)
    error.value = ''
    notice.value = ''
  }
  async function save(status: MomentStatus) {
    if (saving.value || loading.value || !ready.value || !form.content.trim()) return
    saving.value = true
    error.value = ''
    notice.value = ''
    const capture = JSON.stringify(form),
      user = auth.currentUser.value?.id
    const body = { ...(JSON.parse(capture) as MomentEditable), status }
    persistLocal()
    let redirect: string | null = null
    try {
      const note = await repo.save(body, requestId, id.value ?? undefined, revision.value ?? undefined)
      if (!alive || auth.currentUser.value?.id !== user) return
      const wasNew = !id.value
      id.value = note.id
      revision.value = note.revision
      saved.value = note
      serverVersion.value = null
      const value = momentForm(note)
      baseline.value = JSON.stringify(value)
      if (JSON.stringify(form) === capture) Object.assign(form, value)
      notice.value = status === 'published' ? '动态已发布。' : status === 'archived' ? '动态已归档。' : '草稿已保存。'
      store.forget(note.id)
      void app.runWithContext(() => refreshNuxtData('moment-overview'))
      try {
        if (!dirty.value) sessionStorage.removeItem(key())
        else persistLocal()
      } catch {
        localError.value = '保存成功，但本机恢复副本未能清理。'
      }
      recovery.value = null
      if (wasNew && !dirty.value) redirect = `/admin/moments/${encodeURIComponent(note.id)}`
    } catch (cause) {
      if (!alive || auth.currentUser.value?.id !== user) return
      error.value = cause instanceof Error ? cause.message : '保存失败，输入已保留'
      if ((cause as { statusCode?: number }).statusCode === 409) {
        try {
          const latest = id.value ? await repo.adminDetail(id.value) : await repo.submission(requestId)
          if (!alive || auth.currentUser.value?.id !== user) return
          serverVersion.value = latest
          if (!id.value) {
            id.value = latest.id
            revision.value = latest.revision
            saved.value = latest
            error.value = '已找到上次保存的动态，当前输入已保留。请核对服务器版本，再保存为同一条动态。'
          }
        } catch {
          /* 原错误及本机输入保留，待连接恢复后再次读取。 */
        }
      }
      persistLocal()
    } finally {
      if (alive) saving.value = false
    }
    if (redirect) await router.replace(redirect)
  }
  async function reload() {
    if (saving.value || (dirty.value && !window.confirm('当前输入将保留为本标签页恢复副本，是否载入服务器最新版本？')))
      return
    persistLocal()
    await load()
  }
  function restoreRecovery() {
    const value = recovery.value
    if (!value || saving.value) return
    Object.assign(form, value.form)
    id.value = value.id
    revision.value = value.revision
    requestId = value.requestId
    recovery.value = null
    notice.value = '已载入本机输入，请核对后手动保存。'
  }
  function discardRecovery() {
    try {
      sessionStorage.removeItem(key())
      recovery.value = null
    } catch {
      localError.value = '暂时无法移除恢复副本。'
    }
  }
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || saving.value) {
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
    if (dirty.value) {
      persistLocal()
      return window.confirm('有尚未保存的动态输入，已保留本标签页恢复副本，确定离开吗？')
    }
    return true
  })
  watch(form, persistLocal, { deep: true })
  watch(auth.isLoggedIn, (loggedIn) => {
    if (loggedIn && !ready.value) void load()
  })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (next && actor && next !== actor) {
        persistLocal()
        ready.value = false
        id.value = initialId
        revision.value = null
        saved.value = null
        serverVersion.value = null
        Object.assign(form, momentForm())
        baseline.value = JSON.stringify(form)
        requestId = ''
        void load()
      }
    },
  )
  onScopeDispose(() => {
    persistLocal()
    alive = false
    version++
    articleVersion++
    if (articleTimer) clearTimeout(articleTimer)
    articleController?.abort()
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
  return {
    form,
    id,
    saved,
    serverVersion,
    dirty,
    ready,
    loading,
    saving,
    error,
    notice,
    localError,
    recovery,
    change,
    save,
    reload,
    restoreRecovery,
    discardRecovery,
    persistLocal,
    articleChoices,
    articlesPending,
    articlesError,
    searchArticles,
  }
}
