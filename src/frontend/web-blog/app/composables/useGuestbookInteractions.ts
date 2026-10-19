/** @file useGuestbookInteractions.ts @description 留言身份、输入恢复与真实发送/回应，服务端确认前不清空草稿 */
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import { guestbookSession, parseGuestbookRecovery } from '~/features/guestbook/session'
import type { GuestMessage, GuestbookRecord } from '~/features/guestbook/types'
import { ensureVisitorId } from '~/utils/visitorId'
export function useGuestbookInteractions(
  onSent: (record: GuestbookRecord) => Promise<void> | void,
  draftScope = 'public',
) {
  const app = useNuxtApp(),
    // 不用 useI18n：本 composable 也会脱离组件 setup 调用；提示在产生时按当前语言翻译
    t = currentTranslate(),
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
  const key = (actor = state.actor) => `blog-guestbook-draft:${draftScope}:${actor}`
  const expired = computed(() => !auth.isLoggedIn.value && !!auth.authError.value && state.actor.startsWith('admin:'))
  const ready = computed(
    () => mounted.value && auth.initialized.value && !auth.restoringPending.value && !expired.value,
  )
  const identityLabel = computed(() =>
    auth.isLoggedIn.value
      ? t('interaction.guestbookSession.identityOwner')
      : identity.guestIdentity.value?.nickname || t('interaction.guestbookSession.identityGuest'),
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
      state.storageError = t('interaction.guestbookSession.storageSaveFailed')
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
        state.storageError = t('interaction.guestbookSession.storageReadFailed')
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
      state.storageError = t('interaction.guestbookSession.storageReadFailed')
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
    if (state.draft.trim() && !window.confirm(t('interaction.guestbookSession.restoreConfirm'))) return
    const epoch = state.epoch
    state.recovery = null
    state.draft = recovery.content
    state.nonce = recovery.nonce
    state.signature = recovery.signature
    state.revision++
    state.reply = recovery.replyId
      ? { id: recovery.replyId, author: '', content: t('interaction.guestbookSession.replyConfirming') }
      : null
    persist()
    if (recovery.replyId) {
      try {
        const record = await repo.detail(recovery.replyId)
        if (state.epoch === epoch && state.reply?.id === recovery.replyId)
          state.reply = { id: record.id, author: record.author, content: record.content }
      } catch {
        if (state.epoch === epoch && state.reply?.id === recovery.replyId)
          state.reply = {
            id: recovery.replyId,
            author: '',
            content: t('interaction.guestbookSession.replyUnavailable'),
          }
      }
    }
  }
  function discardRecovery() {
    state.recovery = null
    persist()
  }
  let pendingFields: VisitorSubmissionFields = {}
  async function submit(fields?: VisitorSubmissionFields) {
    if (fields) pendingFields = fields
    if (state.submitting || !state.draft.trim()) return
    if (!ready.value) {
      state.error = t('interaction.guestbookSession.confirmLogin')
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
      const record = await repo.create({ ...body, requestId: state.nonce, ...(owner ? {} : pendingFields) }, owner)
      cache.invalidate()
      if (state.epoch !== epoch) return
      if (state.revision === revision) {
        state.draft = ''
        state.reply = null
        state.revision++
      }
      state.nonce = ''
      state.signature = ''
      // 发布成功的留言直接出现在列表中，不再额外提示；仅保留待审核与列表刷新失败的告知。
      let notice = record.moderationStatus === 'pending' ? t('interaction.guestbookSession.savedPending') : ''
      if (alive) {
        try {
          await onSent(record)
        } catch {
          const stale = t('interaction.guestbookSession.listStale')
          notice = notice ? `${notice} ${stale}` : stale
        }
      }
      state.notice = notice
    } catch (cause) {
      if (state.epoch === epoch)
        state.error = cause instanceof Error ? cause.message : t('interaction.guestbookSession.sendFailed')
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
      if (alive)
        reactionErrors.value[value.id] =
          cause instanceof Error ? cause.message : t('interaction.guestbookSession.reactFailed')
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
