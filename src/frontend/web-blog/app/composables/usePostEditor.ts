/**
 * @file usePostEditor.ts
 * @description 博主文章编辑状态：加载、真实保存、发布撤回、失败保留与未保存离开提示
 */
import type { AdminPostDraft } from '~/features/post/adminTypes'
import type { PostRecoveryItem } from '~/utils/postRecovery'
import { copyContentRelations } from '~/features/content-relation/editor'

export function usePostEditor(id: string | null) {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const route = useRoute()
  const { success } = useToast()
  const draft = ref<AdminPostDraft>({
    relatedContent: [],
    title: '',
    summary: '',
    cover: '',
    folder: '随笔日记',
    category: 'life',
    status: 'draft',
    contentRaw: '',
    pinned: false,
    readTimeMinutes: 5,
    tags: [],
  })
  const tags = ref('')
  const options = ref<{ folders: string[]; tags: string[] }>({ folders: [], tags: [] })
  const baseline = ref('')
  const pending = ref(false)
  const ready = ref(false)
  const error = ref('')
  const recovery = usePostRecovery(id)
  const automaticSaving = ref(false)
  const serverAutoSave = ref(true)
  const reviewingPublication = ref(false)
  const autoSavePaused = ref(false)
  const recoverySelection = ref<PostRecoveryItem | null>(null)
  const recoveryServer = ref<AdminPostDraft | null>(null)
  const recoveryReviewPending = ref(false)
  let recoveredSourceKey: string | undefined
  let localTimer: ReturnType<typeof setTimeout> | undefined
  let serverTimer: ReturnType<typeof setTimeout> | undefined
  const conflict = ref<AdminPostDraft | null>(null)
  const preservedLocal = ref<AdminPostDraft | null>(null)
  const localForCompare = computed(() => ({
    ...draft.value,
    // 展开响应式对象不会移除嵌套代理；关联列表必须和标签一样形成独立可克隆快照。
    relatedContent: copyContentRelations(draft.value.relatedContent),
    tags: tags.value
      .split(/[,，]/)
      .map((value) => value.trim())
      .filter(Boolean),
  }))
  const snapshot = computed(() => JSON.stringify({ ...draft.value, tags: tags.value }))
  const dirty = computed(() => ready.value && snapshot.value !== baseline.value)

  onMounted(async () => {
    if (!(await auth.restore())) {
      await navigateTo({ path: '/admin/login', query: { next: route.path } })
      return
    }
    pending.value = true
    try {
      if (id) draft.value = await api<AdminPostDraft>(`/admin/posts/${id}`)
      if (draft.value.deletedAt) {
        error.value = '文章已在回收站，请先在文章管理中恢复为草稿'
        return
      }
      tags.value = draft.value.tags.join(', ')
      baseline.value = snapshot.value
      ready.value = true
      if (auth.currentUser.value) recovery.initialize(auth.currentUser.value.id)
      autoSavePaused.value = recovery.recoveries.value.length > 0
      try {
        options.value = await api('/admin/posts/filters')
      } catch {
        error.value = '目录选项加载失败，仍可手动填写专栏与标签'
      }
    } catch {
      error.value = '文章加载失败，请检查登录状态后重试'
    } finally {
      pending.value = false
    }
  })

  async function save(status: AdminPostDraft['status'], automatic = false) {
    if (pending.value || !ready.value) return
    if (dirty.value) recovery.persist(localForCompare.value)
    pending.value = true
    automaticSaving.value = automatic
    error.value = ''
    const { id: savedId, savedAt: _savedAt, deletedAt: _deletedAt, ...body } = draft.value
    try {
      draft.value = await api<AdminPostDraft>(savedId ? `/admin/posts/${savedId}` : '/admin/posts', {
        method: savedId ? 'PATCH' : 'POST',
        body: {
          ...body,
          status,
          tags: tags.value
            .split(/[,，]/)
            .map((value) => value.trim())
            .filter(Boolean),
        },
      })
      tags.value = draft.value.tags.join(', ')
      baseline.value = snapshot.value
      conflict.value = null
      autoSavePaused.value = false
      recovery.clearSaved(recoveredSourceKey)
      recoveredSourceKey = undefined
      if (!automatic) success(status === 'published' ? '文章已发布' : status === 'draft' ? '草稿已保存' : '文章已归档')
      clearNuxtData((key) => key.startsWith('article-') || key === 'post-list' || key === 'post-metadata')
      if (!id) await navigateTo(`/admin/posts/${draft.value.id}`, { replace: true })
    } catch (cause) {
      autoSavePaused.value = true
      const message = (cause as { data?: { message?: unknown } }).data?.message
      error.value = typeof message === 'string' ? message : '保存失败，未保存内容仍在当前页面'
      if (savedId && [409, 428].includes((cause as { statusCode?: number }).statusCode ?? 0)) {
        try {
          const latest = await api<AdminPostDraft>(`/admin/posts/${savedId}`)
          if (latest.revision !== draft.value.revision) conflict.value = latest
        } catch {
          error.value += '；服务器版本读取失败，可稍后再次保存重试，本地输入仍保留'
        }
      }
    } finally {
      pending.value = false
      automaticSaving.value = false
    }
  }

  function useServerVersion() {
    if (!conflict.value) return
    if (!recovery.preserve(localForCompare.value)) return
    preservedLocal.value = structuredClone(toRaw(localForCompare.value))
    draft.value = structuredClone(toRaw(conflict.value))
    tags.value = draft.value.tags.join(', ')
    baseline.value = snapshot.value
    conflict.value = null
    error.value = ''
  }
  function keepLocalVersion() {
    if (!conflict.value) return
    // 用户比较后显式采用最新版本号，下一次保存仍受版本校验保护。
    draft.value.revision = conflict.value.revision
    autoSavePaused.value = true
    conflict.value = null
    error.value = '已保留当前输入，请合并需要的服务器修改后再次保存；服务器原内容仍在修订历史中'
  }
  function recoverPreservedLocal() {
    if (!preservedLocal.value) return
    const revision = draft.value.revision
    draft.value = { ...structuredClone(toRaw(preservedLocal.value)), revision }
    tags.value = draft.value.tags.join(', ')
    preservedLocal.value = null
    autoSavePaused.value = true
  }

  async function reviewRecovery(item: PostRecoveryItem) {
    if (pending.value || recoveryReviewPending.value) return
    recoveryReviewPending.value = true
    try {
      recoveryServer.value = id
        ? await api<AdminPostDraft>(`/admin/posts/${id}`)
        : structuredClone(toRaw(localForCompare.value))
      recoverySelection.value = item
    } catch {
      error.value = '无法读取最新服务器版本，暂不恢复；本机副本仍保留，请恢复连接后重试'
    } finally {
      recoveryReviewPending.value = false
    }
  }
  function applyRecovery() {
    if (!recoverySelection.value || !recoveryServer.value) return
    if (dirty.value && !recovery.preserve(localForCompare.value)) return
    const current = recoveryServer.value
    draft.value = {
      ...structuredClone(toRaw(recoverySelection.value.draft)),
      id: current.id,
      revision: current.revision,
      status: current.status,
      savedAt: current.savedAt,
    }
    tags.value = draft.value.tags.join(', ')
    recoveredSourceKey = recoverySelection.value.key
    recoverySelection.value = null
    recoveryServer.value = null
    autoSavePaused.value = true
    error.value = '恢复副本已载入编辑器，尚未写入服务器；请检查后手动保存'
    recovery.persist(localForCompare.value)
  }
  function skipRecovery() {
    recoverySelection.value = null
    recoveryServer.value = null
  }
  function discardRecovery(item: PostRecoveryItem) {
    if (!window.confirm('移除这份本机恢复副本？服务器内容不会改变，副本删除后无法恢复。')) return
    recovery.discard(item.key)
  }
  function continueWithoutRecovery() {
    autoSavePaused.value = false
  }
  function persistLocal() {
    if (ready.value && dirty.value) recovery.persist(localForCompare.value)
  }
  function loadHistorical(source: AdminPostDraft) {
    if (pending.value) return
    if (dirty.value && !recovery.preserve(localForCompare.value)) return
    const current = draft.value
    draft.value = {
      id: current.id,
      revision: current.revision,
      savedAt: current.savedAt,
      status: current.status,
      title: source.title,
      slug: source.slug ?? current.slug,
      coverAlt: source.coverAlt ?? current.coverAlt,
      seoTitle: source.seoTitle ?? current.seoTitle,
      seoDescription: source.seoDescription ?? current.seoDescription,
      seoNoindex: source.seoNoindex ?? current.seoNoindex,
      summary: source.summary,
      cover: source.cover,
      category: source.category,
      folder: source.folder,
      contentRaw: source.contentRaw,
      readTimeMinutes: source.readTimeMinutes,
      pinned: source.pinned,
      tags: [...source.tags],
      relatedContent: copyContentRelations(source.relatedContent),
    }
    tags.value = draft.value.tags.join(', ')
    autoSavePaused.value = true
    error.value = '历史修订已载入，尚未写入服务器；请合并检查后手动保存'
    recovery.persist(localForCompare.value)
  }
  async function restoreHistorical(historical: number) {
    if (pending.value || !draft.value.id) return
    if (
      !window.confirm(
        '恢复将创建新的服务器草稿；若文章当前公开，将撤回公开内容。未保存输入会先保留为本机副本。确定恢复吗？',
      )
    )
      return
    if (dirty.value && !recovery.preserve(localForCompare.value)) return
    pending.value = true
    error.value = ''
    try {
      draft.value = await api<AdminPostDraft>(`/admin/posts/${draft.value.id}/revisions/${historical}/restore`, {
        method: 'POST',
        body: { revision: draft.value.revision },
      })
      tags.value = draft.value.tags.join(', ')
      baseline.value = snapshot.value
      conflict.value = null
      autoSavePaused.value = false
      recovery.clearSaved()
      clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
      success('修订已恢复为新的服务器草稿，互动计数保留')
    } catch (cause) {
      autoSavePaused.value = true
      const message = (cause as { data?: { message?: unknown } }).data?.message
      error.value = typeof message === 'string' ? message : '修订恢复失败，当前输入仍保留'
      if ((cause as { statusCode?: number }).statusCode === 409) {
        try {
          const latest = await api<AdminPostDraft>(`/admin/posts/${draft.value.id}`)
          if (latest.revision !== draft.value.revision) conflict.value = latest
        } catch {
          /* 保留恢复失败提示及当前输入。 */
        }
      }
    } finally {
      pending.value = false
    }
  }
  function scheduleSaves() {
    clearTimeout(localTimer)
    clearTimeout(serverTimer)
    if (!ready.value || !dirty.value) return
    localTimer = setTimeout(persistLocal, 400)
    if (
      serverAutoSave.value &&
      !autoSavePaused.value &&
      !conflict.value &&
      !reviewingPublication.value &&
      draft.value.status === 'draft'
    ) {
      serverTimer = setTimeout(() => {
        if (!pending.value && dirty.value && draft.value.title.trim() && draft.value.contentRaw.trim())
          void save('draft', true)
      }, 15000)
    }
  }
  watch([snapshot, serverAutoSave, autoSavePaused, reviewingPublication], scheduleSaves)
  function onPageHidden() {
    if (document.visibilityState === 'hidden') persistLocal()
  }

  onBeforeRouteLeave(() => !dirty.value || window.confirm('有尚未保存的内容，确定离开吗？'))
  // 路由守卫无法覆盖浏览器刷新与关闭标签页，使用原生离开提示保护未保存内容。
  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value) return
    persistLocal()
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => {
    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('visibilitychange', onPageHidden)
  })
  onBeforeUnmount(() => {
    persistLocal()
    clearTimeout(localTimer)
    clearTimeout(serverTimer)
    window.removeEventListener('beforeunload', warnBeforeUnload)
    document.removeEventListener('visibilitychange', onPageHidden)
  })
  return {
    draft,
    tags,
    options,
    pending,
    ready,
    error,
    dirty,
    save,
    conflict,
    localForCompare,
    preservedLocal,
    useServerVersion,
    keepLocalVersion,
    recoverPreservedLocal,
    recovery,
    automaticSaving,
    serverAutoSave,
    autoSavePaused,
    recoverySelection,
    recoveryServer,
    recoveryReviewPending,
    reviewRecovery,
    applyRecovery,
    skipRecovery,
    discardRecovery,
    continueWithoutRecovery,
    persistLocal,
    loadHistorical,
    restoreHistorical,
    reviewingPublication,
  }
}
