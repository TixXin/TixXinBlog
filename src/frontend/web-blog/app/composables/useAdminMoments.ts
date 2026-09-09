/** @file useAdminMoments.ts @description 朋友圈后台分页、发布状态和评论管理；迟到响应不覆盖当前查询 */
import type { ManagedMoment, MomentCommentItem, MomentEditable } from '~/features/moment/types'
import { invalidateMomentComments } from '~/features/moment/session'

export function useAdminMoments() {
  const route = useRoute(),
    router = useRouter(),
    app = useNuxtApp()
  const auth = useCurrentUser(),
    repo = useMomentRepository(),
    store = useMomentStore(),
    toast = useToast()
  const read = (key: string) => {
    const value = route.query[key]
    return String(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''))
  }
  const search = ref(read('q')),
    status = ref(read('status') || 'all'),
    topic = ref(read('topic')),
    date = ref(read('date'))
  const page = computed(() => Math.max(1, Math.min(10000, Number(read('page')) || 1)))
  const items = ref<ManagedMoment[]>([]),
    total = ref(0),
    pending = ref(false),
    error = ref('')
  const busyIds = ref<string[]>([])
  const commentNote = ref<ManagedMoment | null>(null),
    commentItems = ref<MomentCommentItem[]>([])
  const commentTotal = ref(0),
    commentPage = ref(1),
    commentsPending = ref(false),
    commentsError = ref('')
  const replyDraft = ref(''),
    replyRequest = ref(''),
    replyBody = ref('')
  let alive = true,
    version = 0,
    commentsVersion = 0
  let lastActor = auth.currentUser.value?.id
  async function load() {
    const current = ++version
    pending.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error('请先使用博主账号登录。')
      const actor = auth.currentUser.value?.id
      const data = await repo.adminList({
        page: page.value,
        pageSize: 15,
        q: read('q') || undefined,
        status: read('status') || 'all',
        topic: read('topic') || undefined,
        date: read('date') || undefined,
      })
      if (!alive || current !== version || auth.currentUser.value?.id !== actor) return
      items.value = data.items
      total.value = data.total
      const last = Math.max(1, Math.ceil(data.total / 15))
      if (page.value > last) await setPage(last)
    } catch (cause) {
      if (alive && current === version) error.value = cause instanceof Error ? cause.message : '动态读取失败，请重试'
    } finally {
      if (alive && current === version) pending.value = false
    }
  }
  async function applyFilters() {
    const query = Object.fromEntries(
      Object.entries({
        q: search.value.trim(),
        status: status.value,
        topic: topic.value.trim(),
        date: date.value,
      }).filter(([, value]) => value && value !== 'all'),
    )
    if (JSON.stringify(query) === JSON.stringify(route.query)) await load()
    else await router.replace({ path: '/admin/moments', query })
  }
  function setPage(value: number) {
    return router.replace({
      path: '/admin/moments',
      query: { ...route.query, page: value > 1 ? String(value) : undefined },
    })
  }
  async function perform(note: ManagedMoment, operation: () => Promise<void>) {
    if (busyIds.value.includes(note.id) || !auth.isLoggedIn.value) return
    busyIds.value.push(note.id)
    const actor = auth.currentUser.value?.id
    try {
      await operation()
    } catch (cause) {
      if (alive && actor === auth.currentUser.value?.id)
        toast.error(cause instanceof Error ? cause.message : '操作失败，请重试')
    } finally {
      busyIds.value = busyIds.value.filter((id) => id !== note.id)
    }
  }
  async function update(note: ManagedMoment, patch: Partial<MomentEditable>) {
    const actor = auth.currentUser.value?.id
    await perform(note, async () => {
      const result = await repo.update(note.id, patch, note.revision)
      if (result.status !== 'published') store.forget(note.id)
      else store.invalidate()
      void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${note.id}`]))
      if (alive && actor === auth.currentUser.value?.id) {
        if (commentNote.value?.id === note.id) commentNote.value = result
        toast.success('动态状态已更新')
        await load()
      }
    })
  }
  async function remove(note: ManagedMoment) {
    const actor = auth.currentUser.value?.id
    if (busyIds.value.includes(note.id) || !window.confirm('确定删除这条动态及其互动记录吗？')) return
    await perform(note, async () => {
      await repo.remove(note.id, note.revision)
      store.forget(note.id)
      invalidateMomentComments(app, note.id)
      void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${note.id}`]))
      if (alive && actor === auth.currentUser.value?.id) {
        if (commentNote.value?.id === note.id) commentNote.value = null
        toast.success('动态已删除')
        await load()
      }
    })
  }
  async function openComments(note: ManagedMoment, targetPage = 1) {
    if (commentNote.value?.id !== note.id) {
      if (replyDraft.value.trim() && !window.confirm('放弃当前尚未发送的回复？')) return
      commentItems.value = []
      replyDraft.value = ''
      replyRequest.value = ''
      replyBody.value = ''
    }
    const current = ++commentsVersion
    commentNote.value = note
    commentsPending.value = true
    commentsError.value = ''
    const actor = auth.currentUser.value?.id
    try {
      const data = await repo.adminComments(note.id, targetPage)
      if (!alive || current !== commentsVersion || auth.currentUser.value?.id !== actor) return
      const last = Math.max(1, Math.ceil(data.total / 15))
      if (targetPage > last) {
        await openComments(note, last)
        return
      }
      commentItems.value = data.items
      commentTotal.value = data.total
      commentPage.value = data.page
    } catch (cause) {
      if (alive && current === commentsVersion)
        commentsError.value = cause instanceof Error ? cause.message : '评论读取失败，请重试'
    } finally {
      if (alive && current === commentsVersion) commentsPending.value = false
    }
  }
  function closeComments() {
    if (commentNote.value && busyIds.value.includes(commentNote.value.id)) return false
    if (replyDraft.value.trim() && !window.confirm('放弃当前尚未发送的回复？')) return false
    commentsVersion++
    commentNote.value = null
    replyDraft.value = ''
    commentsPending.value = false
    return true
  }
  function invalidateComments(id: string, count: number) {
    invalidateMomentComments(app, id)
    store.patch(id, { comments: [], commentCount: count })
    void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${id}`]))
  }
  async function moderate(comment: MomentCommentItem, next: 'published' | 'pending' | 'hidden') {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value
    if (!note) return
    await perform(note, async () => {
      const result = await repo.moderate(note.id, comment.id, next, comment.moderationStatus ?? 'published')
      invalidateComments(note.id, result.commentCount)
      if (alive && actor === auth.currentUser.value?.id) {
        await openComments(note, commentPage.value)
        await load()
      }
    })
  }
  async function removeComment(comment: MomentCommentItem) {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value
    if (!note || busyIds.value.includes(note.id) || !window.confirm('确定删除这条评论吗？')) return
    await perform(note, async () => {
      const result = await repo.removeComment(note.id, comment.id)
      invalidateComments(note.id, result.commentCount)
      if (alive && actor === auth.currentUser.value?.id) {
        await openComments(note, 1)
        await load()
      }
    })
  }
  async function reply() {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value,
      content = replyDraft.value.trim()
    if (!note || !content) return
    if (replyBody.value !== content) {
      replyBody.value = content
      replyRequest.value = crypto.randomUUID()
    }
    await perform(note, async () => {
      const result = await repo.comment(note.id, { requestId: replyRequest.value, content }, true)
      invalidateComments(note.id, result.commentCount)
      if (alive && actor === auth.currentUser.value?.id) {
        if (replyDraft.value.trim() === content) replyDraft.value = ''
        replyRequest.value = ''
        replyBody.value = ''
        await openComments(note, Math.max(1, Math.ceil((commentTotal.value + 1) / 15)))
        await load()
        toast.success('回复已发送')
      }
    })
  }
  const protectReply = (event: BeforeUnloadEvent) => {
    if (replyDraft.value.trim()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => {
    window.addEventListener('beforeunload', protectReply)
    const edit = read('edit')
    if (edit) void router.replace('/admin/moments/' + encodeURIComponent(edit))
    else void load()
  })
  watch(
    () => route.fullPath,
    () => {
      if (route.path !== '/admin/moments') return
      search.value = read('q')
      status.value = read('status') || 'all'
      topic.value = read('topic')
      date.value = read('date')
      void load()
    },
  )
  watch(auth.isLoggedIn, (loggedIn) => {
    if (loggedIn) {
      void load()
      if (commentNote.value) void openComments(commentNote.value, commentPage.value)
    }
  })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (next && lastActor && next !== lastActor) {
        items.value = []
        commentNote.value = null
        commentItems.value = []
        replyDraft.value = ''
        replyBody.value = ''
        replyRequest.value = ''
        version++
        commentsVersion++
        commentsPending.value = false
        void load()
      }
      if (next) lastActor = next
    },
  )
  onBeforeRouteLeave(() => !replyDraft.value.trim() || window.confirm('有尚未发送的动态回复，确定离开吗？'))
  onScopeDispose(() => {
    if (import.meta.client) window.removeEventListener('beforeunload', protectReply)
    alive = false
    version++
    commentsVersion++
  })
  return {
    restoringPending: auth.restoringPending,
    isLoggedIn: auth.isLoggedIn,
    items,
    total,
    pending,
    error,
    search,
    status,
    topic,
    date,
    page,
    busyIds,
    load,
    applyFilters,
    setPage,
    update,
    remove,
    commentNote,
    commentItems,
    commentTotal,
    commentPage,
    commentsPending,
    commentsError,
    openComments,
    closeComments,
    moderate,
    removeComment,
    replyDraft,
    reply,
  }
}
