/** @file useAdminMoments.ts @description 朋友圈后台分页、发布状态和评论管理；迟到响应不覆盖当前查询 */
import type { ManagedMoment, MomentEditable } from '~/features/moment/types'
import { invalidateMomentComments } from '~/features/moment/session'
import { useAdminMomentComments } from '~/features/moment/useAdminMomentComments'

export function useAdminMoments() {
  const route = useRoute(),
    router = useRouter(),
    app = useNuxtApp()
  const auth = useCurrentUser(),
    repo = useMomentRepository(),
    store = useMomentStore(),
    toast = useToast()
  const { t } = useI18n()
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
  const contentContext = useState<string>('page-content-context', () => '')

  let alive = true,
    version = 0
  let lastActor = auth.currentUser.value?.id

  async function load() {
    const current = ++version
    pending.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error(t('admin-content.moments.loginFirst'))
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
      if (alive && current === version)
        error.value = cause instanceof Error ? cause.message : t('admin-content.moments.loadFailed')
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
        toast.error(cause instanceof Error ? cause.message : t('admin-content.moments.operationFailed'))
    } finally {
      busyIds.value = busyIds.value.filter((id) => id !== note.id)
    }
  }

  const comments = useAdminMomentComments({
    busyIds,
    contentContext,
    load,
    perform,
    read,
  })

  async function update(note: ManagedMoment, patch: Partial<MomentEditable>) {
    const actor = auth.currentUser.value?.id
    await perform(note, async () => {
      const result = await repo.update(note.id, patch, note.revision)
      if (result.status !== 'published') store.forget(note.id)
      else store.invalidate()
      void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${note.id}`]))
      if (alive && actor === auth.currentUser.value?.id) {
        if (comments.commentNote.value?.id === note.id) comments.commentNote.value = result
        toast.success(t('admin-content.moments.statusUpdated'))
        await load()
      }
    })
  }

  async function remove(note: ManagedMoment) {
    const actor = auth.currentUser.value?.id
    if (busyIds.value.includes(note.id) || !window.confirm(t('admin-content.moments.removeConfirm'))) return
    await perform(note, async () => {
      await repo.remove(note.id, note.revision)
      store.forget(note.id)
      invalidateMomentComments(app, note.id)
      void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${note.id}`]))
      if (alive && actor === auth.currentUser.value?.id) {
        if (comments.commentNote.value?.id === note.id) comments.commentNote.value = null
        toast.success(t('admin-content.moments.removed'))
        await load()
      }
    })
  }

  const protectReply = (event: BeforeUnloadEvent) => {
    if (comments.replyDraft.value.trim()) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  onMounted(async () => {
    window.addEventListener('beforeunload', protectReply)
    const edit = read('edit')
    if (edit) void router.replace('/admin/moments/' + encodeURIComponent(edit))
    else {
      await load()
      await comments.openLinkedComments()
    }
  })

  watch(
    () => route.fullPath,
    async () => {
      if (route.path !== '/admin/moments') return
      search.value = read('q')
      status.value = read('status') || 'all'
      topic.value = read('topic')
      date.value = read('date')
      await load()
      await comments.openLinkedComments()
    },
  )

  watch(auth.isLoggedIn, (loggedIn) => {
    if (loggedIn) {
      void load()
      if (comments.commentNote.value) void comments.openComments(comments.commentNote.value, comments.commentPage.value)
    }
  })

  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (next && lastActor && next !== lastActor) {
        items.value = []
        comments.resetActor()
        version++
        void load()
      }
      if (next) lastActor = next
    },
  )

  onBeforeRouteLeave(() => !comments.replyDraft.value.trim() || window.confirm(t('admin-content.moments.leaveConfirm')))

  onScopeDispose(() => {
    if (import.meta.client) window.removeEventListener('beforeunload', protectReply)
    alive = false
    version++
    comments.cancelPending()
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
    commentNote: comments.commentNote,
    commentItems: comments.commentItems,
    commentTotal: comments.commentTotal,
    commentPage: comments.commentPage,
    commentsPending: comments.commentsPending,
    commentsError: comments.commentsError,
    commentTargetId: comments.commentTargetId,
    commentsLinkError: comments.commentsLinkError,
    commentsLinkPending: comments.commentsLinkPending,
    commentsFocusVersion: comments.commentsFocusVersion,
    openLinkedComments: comments.openLinkedComments,
    openComments: comments.openComments,
    closeComments: comments.closeComments,
    moderate: comments.moderate,
    removeComment: comments.removeComment,
    replyDraft: comments.replyDraft,
    replyPending: comments.replyPending,
    reply: comments.reply,
  }
}
