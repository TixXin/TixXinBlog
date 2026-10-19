/** @file useAdminGuestbook.ts @description 留言管理列表、焦点目标和版本化操作（含当前页批量审核与删除），不用迟到响应覆盖当前查询 */
import type { ManagedGuestbookRecord } from '~/features/guestbook/types'
import { describeBatchResult } from '~/composables/useAdminBatchSelection'
import type { AdminBatchResult } from '~/composables/useAdminBatchSelection'
import { apiErrorMessage } from '~/utils/apiError'
export function useAdminGuestbook() {
  const route = useRoute(),
    router = useRouter(),
    app = useNuxtApp(),
    auth = useCurrentUser(),
    repo = useGuestbookRepository(),
    cache = useGuestbookCache(),
    adminApi = useAdminApi(),
    toast = useToast(),
    // 在 setup 内取翻译函数：失败处理发生在 await 之后仍可使用
    { t } = useI18n()
  const read = (name: string) => (typeof route.query[name] === 'string' ? (route.query[name] as string) : '')
  const q = ref(read('q')),
    status = ref(read('status') || 'all'),
    unanswered = ref(read('unanswered') === 'true'),
    date = ref(read('date'))
  const page = computed(() => {
    const value = Number(read('page'))
    return Number.isInteger(value) && value > 0 ? Math.min(value, 10000) : 1
  })
  const items = ref<ManagedGuestbookRecord[]>([]),
    total = ref(0),
    pending = ref(false),
    error = ref(''),
    busy = ref<number[]>([])
  const selected = ref<ManagedGuestbookRecord | null>(null),
    detailPending = ref(false),
    detailError = ref('')
  const focusId = ref<number | null>(null)
  const selection = useAdminBatchSelection(items),
    batchBusy = ref('')
  let version = 0,
    detailVersion = 0,
    alive = true,
    actor = auth.currentUser.value?.id
  async function load() {
    const current = ++version
    pending.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error(t('admin-media.guestbook.loginRequired'))
      const identity = auth.currentUser.value?.id
      const value = await repo.adminList({
        page: page.value,
        pageSize: 20,
        q: read('q') || undefined,
        date: read('date') || undefined,
        status: read('status') || 'all',
        unanswered: read('unanswered') === 'true' ? 'true' : undefined,
      })
      if (!alive || current !== version || auth.currentUser.value?.id !== identity) return
      items.value = value.items
      total.value = value.total
      if (page.value > Math.max(1, Math.ceil(value.total / 20))) await setPage(Math.max(1, Math.ceil(value.total / 20)))
    } catch (cause) {
      if (alive && current === version)
        error.value = cause instanceof Error ? cause.message : t('admin-media.guestbook.loadFailed')
    } finally {
      if (alive && current === version) pending.value = false
    }
  }
  async function focus(id: number) {
    focusId.value = id
    const current = ++detailVersion,
      identity = auth.currentUser.value?.id
    detailPending.value = true
    detailError.value = ''
    try {
      const item = await repo.adminDetail(id)
      if (alive && current === detailVersion && identity === auth.currentUser.value?.id) selected.value = item
    } catch (cause) {
      if (alive && current === detailVersion)
        detailError.value = cause instanceof Error ? cause.message : t('admin-media.guestbook.loadFailed')
    } finally {
      if (alive && current === detailVersion) detailPending.value = false
    }
  }
  function close() {
    detailVersion++
    selected.value = null
    focusId.value = null
    detailPending.value = false
    detailError.value = ''
  }
  async function apply() {
    const query = Object.fromEntries(
      Object.entries({
        q: q.value.trim(),
        status: status.value === 'all' ? '' : status.value,
        unanswered: unanswered.value ? 'true' : '',
        date: date.value,
      }).filter(([, value]) => !!value),
    )
    if (JSON.stringify(query) === JSON.stringify(route.query)) await load()
    else await router.replace({ path: '/admin/guestbook', query })
  }
  function setPage(value: number) {
    return router.replace({
      path: '/admin/guestbook',
      query: { ...route.query, page: value > 1 ? String(value) : undefined },
    })
  }
  async function change(
    note: ManagedGuestbookRecord,
    patch: { status?: 'published' | 'pending' | 'hidden'; isPinned?: boolean },
    remove = false,
  ) {
    if (busy.value.includes(note.id) || !auth.isLoggedIn.value) return
    if (remove && !window.confirm(t('admin-media.guestbook.removeConfirm'))) return
    const identity = auth.currentUser.value?.id
    busy.value.push(note.id)
    error.value = ''
    try {
      if (remove) await repo.remove(note.id, note.revision)
      else await repo.update(note.id, { ...patch, revision: note.revision })
      cache.invalidate(note.id)
      void app.runWithContext(() => refreshNuxtData('guestbook-metadata'))
      if (!alive || identity !== auth.currentUser.value?.id) return
      if (selected.value?.id === note.id) {
        if (remove) close()
        else await focus(note.id)
      }
      await load()
    } catch (cause) {
      if (alive && identity === auth.currentUser.value?.id) {
        const message = cause instanceof Error ? cause.message : t('admin-media.guestbook.mutateFailed')
        if ((cause as { statusCode?: number }).statusCode === 409) await load()
        error.value = message
      }
    } finally {
      busy.value = busy.value.filter((id) => id !== note.id)
    }
  }
  /** 批量公开、隐藏或删除当前页选中的留言；删除需确认，跳过已删除或已变化的项并提示刷新核对 */
  async function batch(action: 'published' | 'hidden' | 'delete') {
    const notes = selection.selectedItems.value
    if (!notes.length || batchBusy.value || busy.value.length || !auth.isLoggedIn.value) return
    const remove = action === 'delete'
    if (remove && !window.confirm(t('admin-media.guestbook.batchRemoveConfirm', { count: notes.length }, notes.length)))
      return
    const identity = auth.currentUser.value?.id
    const ids = notes.map((note) => note.id)
    batchBusy.value = action
    busy.value.push(...ids)
    error.value = ''
    try {
      const body = { items: notes.map((note) => ({ id: note.id, revision: note.revision })) }
      const result = remove
        ? await adminApi<AdminBatchResult>('/admin/guestbook/batch', { method: 'DELETE', body })
        : await adminApi<AdminBatchResult>('/admin/guestbook/batch', {
            method: 'PATCH',
            body: { ...body, status: action },
          })
      ids.forEach((id) => cache.invalidate(id))
      void app.runWithContext(() => refreshNuxtData('guestbook-metadata'))
      if (!alive || identity !== auth.currentUser.value?.id) return
      selection.clear()
      if (selected.value && ids.includes(selected.value.id)) {
        if (remove) close()
        else await focus(selected.value.id)
      }
      await load()
      const message = describeBatchResult(
        result,
        t(`admin-media.guestbook.batchDone.${action}`),
        t('admin-media.guestbook.batchNoun'),
      )
      // 列表重新读取会清空错误提示，因此在刷新之后再展示跳过项。
      if (result.failedCount) error.value = message
      else toast.success(message)
    } catch (cause) {
      if (alive && identity === auth.currentUser.value?.id) {
        error.value = apiErrorMessage(cause, 'admin-media.guestbook.batchFailed', { t })
      }
    } finally {
      batchBusy.value = ''
      busy.value = busy.value.filter((id) => !ids.includes(id))
    }
  }
  onMounted(async () => {
    await load()
    const id = Number(read('focus'))
    if (alive && Number.isInteger(id) && id > 0) await focus(id)
  })
  watch(
    () => route.fullPath,
    () => {
      if (route.path !== '/admin/guestbook') return
      q.value = read('q')
      status.value = read('status') || 'all'
      unanswered.value = read('unanswered') === 'true'
      date.value = read('date')
      void load()
    },
  )
  watch(auth.isLoggedIn, (value) => {
    if (value) void load()
  })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (next && actor && next !== actor) {
        version++
        close()
        items.value = []
        void load()
      }
      if (next) actor = next
    },
  )
  onScopeDispose(() => {
    alive = false
    version++
    detailVersion++
  })
  return {
    isLoggedIn: auth.isLoggedIn,
    restoring: auth.restoringPending,
    q,
    status,
    unanswered,
    date,
    page,
    items,
    total,
    pending,
    error,
    busy,
    selected,
    detailPending,
    detailError,
    load,
    focus,
    close,
    apply,
    setPage,
    change,
    selection,
    batchBusy,
    batch,
    retryDetail: () => focusId.value !== null && focus(focusId.value),
  }
}
