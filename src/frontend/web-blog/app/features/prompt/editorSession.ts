/** @file editorSession.ts @description 页内提示词编辑器的会话状态、归属判断与读取：账号与内容库归属、请求代次和恢复副本 */
import { createDirtyTracker } from '~/utils/editorState'
import { promptForm } from './editor'
import type { PromptRecovery } from './editor'
import type { ManagedPrompt, PromptForm } from './types'
import { usePromptPersistence } from './usePromptPersistence'

/** 编辑器状态与本标签页恢复副本 */
function createPromptEditorState(initialId: number | null) {
  const form = reactive(promptForm()),
    id = ref(initialId),
    revision = ref<number | null>(null)
  const ready = ref(false),
    loading = ref(false),
    saving = ref(false),
    error = ref(''),
    notice = ref('')
  const localError = ref(''),
    recovery = ref<PromptRecovery | null>(null),
    serverVersion = ref<ManagedPrompt | null>(null),
    requiresReload = ref(false)
  const { dirty, markClean } = createDirtyTracker(form)
  const pendingCreate = ref<PromptForm | null>(null)
  const storageId = ref(initialId)
  const fields = { form, id, revision, ready, loading, saving, error, notice, localError, recovery, serverVersion }
  return { ...fields, requiresReload, dirty, markClean, pendingCreate, storageId }
}

export function createPromptEditorSession(initialId: number | null) {
  const repo = usePromptRepository(),
    auth = useCurrentUser()
  // 用全局 i18n 实例而非 useI18n：提示在产生时按当前语言翻译
  const { t } = useNuxtApp().$i18n
  const context = useState<string>('page-content-context', () => '')
  const state = createPromptEditorState(initialId)
  /** 会话归属与请求代次：账号、登录或内容库变化后，旧请求的结果一律丢弃 */
  const meta = { actor: '', ownedContext: '', requestId: '', alive: true, generation: 0 }
  const persistence = usePromptPersistence({
    initialId,
    ...state,
    getMeta: () => ({ actor: meta.actor, ownedContext: meta.ownedContext, requestId: meta.requestId }),
    setRequestId: (val) => {
      meta.requestId = val
    },
    t,
  })
  const ownershipLost = computed(() => {
    const currentActor = auth.currentUser.value?.id,
      currentContext = context.value,
      authenticated = auth.isLoggedIn.value
    return !!meta.actor && (!authenticated || currentActor !== meta.actor || currentContext !== meta.ownedContext)
  })
  const owns = (version: number) =>
    meta.alive &&
    version === meta.generation &&
    auth.isLoggedIn.value &&
    auth.currentUser.value?.id === meta.actor &&
    context.value === meta.ownedContext
  return { ...state, initialId, repo, auth, t, context, meta, persistence, ownershipLost, owns }
}

export type PromptEditorSession = ReturnType<typeof createPromptEditorSession>

/** 读取：恢复登录、认领会话、读取恢复副本，没有未保存改动时以服务器详情为准 */
export function createPromptLoader(s: PromptEditorSession) {
  const { auth, meta, t } = s
  function accept(item: ManagedPrompt) {
    s.id.value = item.id
    s.revision.value = item.revision
    Object.assign(s.form, promptForm(item))
    s.markClean()
  }
  /** 确认登录并认领会话；同一编辑器只服务首次读取时的账号与内容库。代次已过期时返回 false */
  async function claim(isCurrent: () => boolean) {
    if (!(await auth.restore())) throw new Error(t('misc.prompt.editorState.loginRequired'))
    if (!isCurrent()) return false
    const currentActor = auth.currentUser.value!.id
    if (meta.actor && (meta.actor !== currentActor || meta.ownedContext !== s.context.value))
      throw new Error(t('misc.prompt.editorState.contextChangedReopen'))
    meta.actor = currentActor
    meta.ownedContext = s.context.value
    meta.requestId ||= crypto.randomUUID()
    return true
  }
  async function load() {
    if (s.requiresReload.value) return
    const version = ++meta.generation
    s.loading.value = true
    s.error.value = ''
    const isCurrent = () => meta.alive && version === meta.generation
    try {
      if (!(await claim(isCurrent))) return
      s.persistence.readRecovery()
      const item = s.initialId ? await s.repo.adminDetail(s.initialId) : null
      if (!s.owns(version)) return
      if (item && !s.dirty.value) accept(item)
      s.ready.value = true
    } catch (cause) {
      if (isCurrent()) s.error.value = cause instanceof Error ? cause.message : t('misc.prompt.editorState.loadFailed')
    } finally {
      if (isCurrent()) s.loading.value = false
    }
  }
  return { load }
}
