/** @file useMomentInteractions.ts @description 朋友圈互动编排；展示组件只接收状态与事件 */
import { momentSession, seedMomentState } from '~/features/moment/session'
import type { MomentItem } from '~/features/moment/types'

export function useMomentInteractions() {
  const app = useNuxtApp()
  const session = momentSession(app)
  const repo = useMomentRepository()
  const store = useMomentStore()
  const auth = useCurrentUser()
  const identity = useGuestIdentity()
  const login = useLoginDrawer()
  const toast = useToast()
  const identityVisible = ref(false)
  let waitingId: string | null = null
  const protectInput = (event: BeforeUnloadEvent) => {
    if (Object.values(session.states).some((state) => state.draft.trim() || state.submitting)) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(() => window.addEventListener('beforeunload', protectInput))
  onScopeDispose(() => {
    if (import.meta.client) window.removeEventListener('beforeunload', protectInput)
  })
  function seed(notes: MomentItem[]) {
    notes.forEach((note) => seedMomentState(session, note))
  }
  function stateFor(id: string) {
    const note = store.entries.value[id]
    return session.states[id] ?? (note ? seedMomentState(session, note) : undefined)
  }
  function draft({ id, value }: { id: string; value: string }) {
    const state = stateFor(id)
    if (state) {
      state.draft = value.slice(0, 1000)
      state.submitError = ''
      state.notice = ''
    }
  }
  async function like({ id, liked, complete }: { id: string; liked: boolean; complete?: (success: boolean) => void }) {
    const state = stateFor(id)
    if (!state || state.likePending) return
    state.likePending = true
    const epoch = session.epoch
    try {
      const result = await repo.like(id, liked)
      if (epoch !== session.epoch) return
      store.patch(id, result)
      complete?.(true)
      void app.runWithContext(() => refreshNuxtData('moment-overview'))
    } catch (cause) {
      if (epoch === session.epoch) toast.error(cause instanceof Error ? cause.message : '点赞失败，请重试')
      complete?.(false)
    } finally {
      if (epoch === session.epoch) state.likePending = false
    }
  }
  async function comments(id: string, reset = false) {
    const state = stateFor(id)
    if (!state || state.loading) return
    state.loading = true
    state.loadError = ''
    const epoch = session.epoch
    const version = state.version
    const page = reset || !state.initialized ? 1 : state.page + 1
    try {
      const result = await repo.comments(id, page)
      if (epoch !== session.epoch || version !== state.version) return
      const merged = new Map((page === 1 ? [] : state.comments).map((comment) => [comment.id, comment]))
      result.items.forEach((comment) => merged.set(comment.id, comment))
      state.comments = [...merged.values()].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
      state.total = result.total
      state.page = result.page
      state.initialized = true
    } catch (cause) {
      if (epoch === session.epoch && version === state.version)
        state.loadError = cause instanceof Error ? cause.message : '评论加载失败，请重试'
    } finally {
      if (epoch === session.epoch && version === state.version) state.loading = false
    }
  }
  async function submit(id: string) {
    const state = stateFor(id)
    if (!state || state.submitting || !state.draft.trim()) return
    if (!auth.isLoggedIn.value && !identity.hasIdentity.value) {
      waitingId = id
      identityVisible.value = true
      return
    }
    const content = state.draft.trim()
    const owner = auth.isLoggedIn.value
    const value = {
      content,
      ...(owner ? {} : { author: identity.guestIdentity.value!.nickname, avatar: identity.resolveAvatar() }),
    }
    const key = JSON.stringify({ ...value, owner })
    if (state.requestBody !== key) {
      state.requestId = crypto.randomUUID()
      state.requestBody = key
    }
    const epoch = session.epoch
    state.submitting = true
    state.submitError = ''
    state.notice = ''
    const version = state.version
    try {
      const result = await repo.comment(id, { ...value, requestId: state.requestId }, owner)
      if (epoch !== session.epoch) return
      if (version !== state.version) {
        if (state.draft.trim() === content) state.draft = ''
        state.notice = '提交已处理，评论状态已变化，请重新加载查看。'
        void comments(id, true)
        return
      }
      const known = state.comments.some((comment) => comment.id === result.id)
      if (!known) state.comments.push(result)
      state.total = Math.max(state.total + (known ? 0 : 1), result.commentCount)
      store.patch(id, { commentCount: result.commentCount, comments: [...state.comments].slice(-3) })
      if (state.draft.trim() === content) state.draft = ''
      state.requestId = ''
      state.requestBody = ''
      state.notice = result.moderationStatus === 'pending' ? '评论已提交，审核通过后公开。' : '评论已发送。'
      void app.runWithContext(() => refreshNuxtData('moment-overview'))
    } catch (cause) {
      if (epoch === session.epoch)
        state.submitError = cause instanceof Error ? cause.message : '评论发送失败，内容已保留'
    } finally {
      if (epoch === session.epoch) state.submitting = false
    }
  }
  function confirmIdentity() {
    identityVisible.value = false
    const id = waitingId
    waitingId = null
    if (id) void submit(id)
  }
  function cancelIdentity() {
    identityVisible.value = false
    waitingId = null
  }
  function switchToLogin() {
    identityVisible.value = false
    login.open('login')
  }
  watch(auth.isLoggedIn, (loggedIn) => {
    if (loggedIn && waitingId) confirmIdentity()
  })
  return {
    states: session.states,
    seed,
    draft,
    like,
    comments,
    submit,
    identityVisible,
    confirmIdentity,
    cancelIdentity,
    switchToLogin,
  }
}
