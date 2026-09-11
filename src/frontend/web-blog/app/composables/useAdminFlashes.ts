/**
 * @file useAdminFlashes.ts
 * @description 后台闪念真实分页、编辑和状态操作，失败保留编辑器输入。
 */
import type { FlashNote, FlashNoteDraft } from '~/features/flash/types'

export function useAdminFlashes() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const { success } = useToast()
  const route = useRoute()
  const router = useRouter()
  const read = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
  const initialStatus = route.query.status
  const status = ref(
    typeof initialStatus === 'string' && ['draft', 'published', 'archived'].includes(initialStatus)
      ? initialStatus
      : 'all',
  )
  const search = ref(read('search'))
  const readPage = () => (/^\d+$/.test(read('page')) ? Math.max(1, Math.min(Number(read('page')), 10000)) : 1)
  const page = ref(readPage())
  const items = ref<FlashNote[]>([])
  const total = ref(0)
  const pending = ref(false)
  const working = ref(false)
  const mounted = ref(false)
  const editorReady = computed(() => mounted.value && auth.isLoggedIn.value && !auth.restoringPending.value)
  const error = ref('')
  const editorOpen = ref(false)
  const editing = ref<FlashNote | null>(null)
  const dirty = ref(false)
  const editorKey = ref(0)
  const editorError = ref('')
  const commentNote = ref<FlashNote | null>(null)
  let version = 0
  function message(cause: unknown, fallback: string) {
    const value = (cause as { data?: { message?: unknown } }).data?.message
    return typeof value === 'string' ? value : fallback
  }
  function canDiscard() {
    return !dirty.value || window.confirm('闪念有尚未保存的内容，确定放弃吗？')
  }
  async function load() {
    const current = ++version
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: FlashNote[]; total: number }>('/admin/flashes', {
        query: { page: page.value, pageSize: 20, status: status.value, search: search.value.trim() || undefined },
      })
      if (current !== version) return
      items.value = result.items
      total.value = result.total
      const last = Math.max(1, Math.ceil(total.value / 20))
      if (page.value > last) {
        page.value = last
        await router.replace({
          path: '/admin/flashes',
          query: { ...route.query, page: last > 1 ? String(last) : undefined },
        })
      }
    } catch (cause) {
      if (current === version) {
        items.value = []
        error.value = message(cause, '闪念列表加载失败，请重试')
      }
    } finally {
      if (current === version) pending.value = false
    }
  }
  async function syncQuery() {
    const query = {
      ...(status.value !== 'all' ? { status: status.value } : {}),
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    }
    if (JSON.stringify(query) === JSON.stringify(route.query)) await load()
    else await router.replace({ path: '/admin/flashes', query })
  }
  function resetPage() {
    page.value = 1
    void syncQuery()
  }
  function changePage(value: number) {
    page.value = value
    void syncQuery()
  }
  async function openEditor(note?: Pick<FlashNote, 'id'>) {
    if (!editorReady.value || working.value || !canDiscard()) return
    working.value = true
    error.value = ''
    try {
      const fresh = note ? await api<FlashNote>(`/admin/flashes/${encodeURIComponent(note.id)}`) : null
      editing.value = fresh
      editorError.value = ''
      editorKey.value += 1
      dirty.value = false
      editorOpen.value = true
    } catch (cause) {
      error.value = message(cause, '闪念读取失败，原编辑内容已保留')
    } finally {
      working.value = false
    }
  }
  function closeEditor() {
    if (working.value || !canDiscard()) return
    editorOpen.value = false
    editing.value = null
    dirty.value = false
  }
  async function save(input: FlashNoteDraft) {
    if (working.value) return
    working.value = true
    editorError.value = ''
    try {
      const id = editing.value?.id
      await api(`/admin/flashes${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: {
          content: input.content,
          tags: input.tags,
          images: input.images ?? [],
          type: input.type ?? 'memo',
          isDraft: !!input.isDraft,
          isArchived: false,
          isPinned: editing.value?.isPinned ?? false,
        },
      })
      dirty.value = false
      editorOpen.value = false
      editing.value = null
      success(input.isDraft ? '闪念草稿已保存' : '闪念已发布')
      await load()
    } catch (cause) {
      editorError.value = message(cause, '保存失败，输入已保留，请重试')
    } finally {
      working.value = false
    }
  }
  async function update(note: FlashNote, action: 'pin' | 'archive' | 'restore' | 'withdraw' | 'publish') {
    if (working.value || pending.value) return
    if (dirty.value) {
      error.value = '请先保存或取消当前编辑，再操作列表状态'
      return
    }
    const labels = {
      pin: note.isPinned ? '取消置顶' : '置顶',
      archive: '归档',
      restore: '恢复为草稿',
      withdraw: '撤回为草稿',
      publish: '发布',
    }
    if (
      action !== 'pin' &&
      !window.confirm(
        `确定${labels[action]}这条闪念？${action === 'restore' || action === 'withdraw' ? '草稿不会公开。' : ''}`,
      )
    )
      return
    working.value = true
    error.value = ''
    const body =
      action === 'pin'
        ? { isPinned: !note.isPinned }
        : action === 'archive'
          ? { isArchived: true }
          : action === 'restore'
            ? { isArchived: false, isDraft: true }
            : { isDraft: action === 'withdraw' }
    try {
      await api(`/admin/flashes/${note.id}`, { method: 'PATCH', body })
      if (editing.value?.id === note.id) {
        editorOpen.value = false
        editing.value = null
      }
      success(`已${labels[action]}`)
      await load()
    } catch (cause) {
      error.value = message(cause, '操作失败，请重试')
    } finally {
      working.value = false
    }
  }
  async function showComments(note: FlashNote) {
    if (working.value) return
    working.value = true
    error.value = ''
    try {
      commentNote.value = await api<FlashNote>(`/admin/flashes/${note.id}`)
    } catch (cause) {
      error.value = message(cause, '评论加载失败，请重试')
    } finally {
      working.value = false
    }
  }
  async function removeComment(id: string) {
    const note = commentNote.value
    if (!note || working.value || !window.confirm('永久删除这条闪念评论？无法恢复，闪念正文保留。')) return
    working.value = true
    error.value = ''
    try {
      await api(`/admin/flashes/${note.id}/comments/${id}`, { method: 'DELETE' })
      commentNote.value = await api<FlashNote>(`/admin/flashes/${note.id}`)
      success('评论已删除')
      await load()
    } catch (cause) {
      error.value = message(cause, '评论删除或刷新失败，请重新查看评论')
    } finally {
      working.value = false
    }
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onBeforeRouteLeave(() => !working.value && canDiscard())
  onBeforeRouteUpdate(
    (to, from) =>
      !working.value && ((to.query.edit === from.query.edit && to.query.create === from.query.create) || canDiscard()),
  )
  async function openLinkedEditor() {
    if (read('edit')) await openEditor({ id: read('edit') })
    else if (read('create') === 'true') await openEditor()
  }
  watch(
    () => route.fullPath,
    async (next, previous) => {
      if (!mounted.value || route.path !== '/admin/flashes' || next === previous) return
      status.value = ['draft', 'published', 'archived'].includes(read('status')) ? read('status') : 'all'
      search.value = read('search')
      page.value = readPage()
      await load()
      await openLinkedEditor()
    },
  )
  onMounted(async () => {
    mounted.value = true
    window.addEventListener('beforeunload', beforeUnload)
    if (await auth.restore()) {
      await load()
      await openLinkedEditor()
    } else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
  })
  onBeforeUnmount(() => {
    mounted.value = false
    version += 1
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return {
    status,
    search,
    page,
    items,
    total,
    pending,
    working,
    editorReady,
    error,
    editorOpen,
    editing,
    dirty,
    editorKey,
    editorError,
    commentNote,
    load,
    resetPage,
    changePage,
    openEditor,
    closeEditor,
    save,
    update,
    showComments,
    removeComment,
  }
}
