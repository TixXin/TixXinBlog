/** @file useGuestbookInteractions.ts @description 留言身份、输入恢复与真实发送/回应，服务端确认前不清空草稿 */
import { guestbookSession, parseGuestbookRecovery } from '~/features/guestbook/session'
import type { GuestMessage, GuestbookRecord } from '~/features/guestbook/types'
import { ensureVisitorId } from '~/utils/visitorId'
export function useGuestbookInteractions(
  onSent: (record: GuestbookRecord) => Promise<void> | void,
  draftScope = 'public',
) {
  const app = useNuxtApp(),
    auth = useCurrentUser(),
    identity = useGuestIdentity(),
    login = useLoginDrawer()
  const repo = useGuestbookRepository(),
    cache = useGuestbookCache(),
    state = guestbookSession(app, draftScope)
  const mounted = ref(false),
    identityVisible = ref(false),
    reacting = ref<number[]>([]),
    reactionErrors = ref<Record<number, string>>({})
  let alive = true
  const key = (actor = state.actor) => `tixxin-guestbook-draft:${draftScope}:${actor}`
  const expired = computed(() => !auth.isLoggedIn.value && !!auth.authError.value && state.actor.startsWith('admin:'))
  const ready = computed(
    () => mounted.value && auth.initialized.value && !auth.restoringPending.value && !expired.value,
  )
  const identityLabel = computed(() =>
    auth.isLoggedIn.value ? '博主' : identity.guestIdentity.value?.nickname || '访客',
  )
  function persist() {
    if (!import.meta.client || !state.actor || state.recovery) return
    try {
      if (state.draft.trim() || state.submitting)
        sessionStorage.setItem(
          key(),
          JSON.stringify({
            content: state.draft,
            replyId: state.reply?.id ?? null,
            nonce: state.nonce,
            signature: state.signature,
          }),
        )
      else sessionStorage.removeItem(key())
      state.storageError = ''
    } catch {
      state.storageError = '恢复副本暂时无法保存，请保留当前页面输入。'
    }
  }
  function synchronizeActor() {
    if (!mounted.value || !auth.initialized.value || auth.restoringPending.value || expired.value) return
    const actor = auth.isLoggedIn.value ? 'admin:' + auth.currentUser.value!.id : 'visitor:' + ensureVisitorId()
    if (state.actor === actor) return
    if (!state.actor) {
      state.actor = actor
      try {
        state.recovery = parseGuestbookRecovery(sessionStorage.getItem(key()))
      } catch {
        state.storageError = '恢复副本暂时无法读取。'
      }
      persist()
      return
    }
    persist()
    Object.assign(state, {
      actor,
      draft: '',
      reply: null,
      nonce: '',
      signature: '',
      submitting: false,
      error: '',
      notice: '',
      recovery: null,
      revision: state.revision + 1,
      epoch: state.epoch + 1,
    })
    try {
      state.recovery = parseGuestbookRecovery(sessionStorage.getItem(key()))
    } catch {
      state.storageError = '恢复副本暂时无法读取。'
    }
  }
  function setDraft(value: string) {
    state.draft = value.slice(0, 500)
    state.revision++
    state.error = ''
    state.notice = ''
    persist()
  }
  function setReply(message: GuestMessage | null) {
    state.reply = message ? { id: message.id, author: message.author, content: message.content } : null
    state.revision++
    persist()
  }
  async function restore() {
    const recovery = state.recovery
    if (!recovery || state.submitting) return
    if (state.draft.trim() && !window.confirm('载入恢复副本将替换当前未发送输入，确定继续吗？')) return
    const epoch = state.epoch
    state.recovery = null
    state.draft = recovery.content
    state.nonce = recovery.nonce
    state.signature = recovery.signature
    state.revision++
    state.reply = recovery.replyId ? { id: recovery.replyId, author: '', content: '正在确认引用…' } : null
    persist()
    if (recovery.replyId) {
      try {
        const record = await repo.detail(recovery.replyId)
        if (state.epoch === epoch && state.reply?.id === recovery.replyId)
          state.reply = { id: record.id, author: record.author, content: record.content }
      } catch {
        if (state.epoch === epoch && state.reply?.id === recovery.replyId)
          state.reply = { id: recovery.replyId, author: '', content: '引用暂不可见，可取消引用或重试原提交' }
      }
    }
  }
  function discardRecovery() {
    state.recovery = null
    persist()
  }
  async function submit() {
    if (state.submitting || !state.draft.trim()) return
    if (!ready.value) {
      state.error = '请先确认登录状态，输入已保留。'
      return
    }
    if (!auth.isLoggedIn.value && !identity.hasIdentity.value) {
      identityVisible.value = true
      return
    }
    const owner = auth.isLoggedIn.value,
      content = state.draft.trim(),
      epoch = state.epoch,
      revision = state.revision
    const body = {
      content,
      replyToId: state.reply?.id ?? null,
      ...(owner ? {} : { author: identity.guestIdentity.value!.nickname, avatar: identity.resolveAvatar() }),
    }
    const signature = JSON.stringify({ actor: state.actor, ...body })
    if (signature !== state.signature) {
      state.nonce = crypto.randomUUID()
      state.signature = signature
    }
    state.submitting = true
    state.error = ''
    state.notice = ''
    persist()
    try {
      const record = await repo.create({ ...body, requestId: state.nonce }, owner)
      cache.invalidate()
      if (state.epoch !== epoch) return
      if (state.revision === revision) {
        state.draft = ''
        state.reply = null
        state.revision++
      }
      state.nonce = ''
      state.signature = ''
      state.notice = record.moderationStatus === 'pending' ? '留言已保存，审核通过后公开。' : '留言已发送。'
      if (alive) {
        try {
          await onSent(record)
        } catch {
          state.notice += ' 列表暂未更新，可刷新查看。'
        }
      }
    } catch (cause) {
      if (state.epoch === epoch)
        state.error = cause instanceof Error ? cause.message : '发送未完成，输入已保留；重试相同内容不会重复发送。'
    } finally {
      if (state.epoch === epoch) {
        state.submitting = false
        persist()
      }
    }
  }
  async function react(value: { id: number; emoji: string; reacted: boolean; complete?: () => void }) {
    if (reacting.value.includes(value.id)) return
    reacting.value.push(value.id)
    Reflect.deleteProperty(reactionErrors.value, value.id)
    const generation = cache.generation.value
    try {
      const result = await repo.react(value.id, value.emoji, value.reacted)
      if (generation === cache.generation.value) cache.patch(value.id, { reactions: result.reactions })
    } catch (cause) {
      if (alive) reactionErrors.value[value.id] = cause instanceof Error ? cause.message : '回应失败，请重试'
    } finally {
      reacting.value = reacting.value.filter((id) => id !== value.id)
      if (alive) {
        await nextTick()
        value.complete?.()
      }
    }
  }
  const protect = (event: BeforeUnloadEvent) => {
    if (state.draft.trim() || state.submitting) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onMounted(async () => {
    mounted.value = true
    await auth.restore()
    if (!alive) return
    synchronizeActor()
    window.addEventListener('beforeunload', protect)
  })
  watch([auth.currentUser, auth.initialized, auth.restoringPending, auth.authError], synchronizeActor)
  onScopeDispose(() => {
    alive = false
    persist()
    if (import.meta.client) window.removeEventListener('beforeunload', protect)
  })
  return {
    state,
    ready,
    expired,
    identityLabel,
    identityVisible,
    reacting,
    reactionErrors,
    setDraft,
    setReply,
    persist,
    restore,
    discardRecovery,
    submit,
    react,
    confirmIdentity: async () => {
      identityVisible.value = false
      await nextTick()
      await submit()
    },
    openLogin: () => {
      identityVisible.value = false
      login.open('login')
    },
  }
}
