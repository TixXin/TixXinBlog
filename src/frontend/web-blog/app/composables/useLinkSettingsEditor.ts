/** @file useLinkSettingsEditor.ts @description 友链须知维护与分内容库草稿保护，不承诺未实施的申请审核流程 */
import type { LinkSettings } from '~/features/link/types'
import { editorRecoveryKey, readEditorRecoveries } from '~/utils/editorRecoveryStorage'
interface RulesRecovery {
  version: 1
  context: string
  rules: string[]
  savedAt: string
}
function parseRulesRecovery(raw: string | null): RulesRecovery | null {
  if (!raw || raw.length > 15000) return null
  try {
    const value = JSON.parse(raw) as RulesRecovery
    return value.version === 1 &&
      typeof value.context === 'string' &&
      value.context.length <= 200 &&
      typeof value.savedAt === 'string' &&
      Array.isArray(value.rules) &&
      value.rules.length <= 12 &&
      value.rules.every((rule) => typeof rule === 'string' && rule.length <= 300)
      ? { version: 1, context: value.context, savedAt: value.savedAt, rules: [...value.rules] }
      : null
  } catch {
    return null
  }
}
export function useLinkSettingsEditor() {
  const repo = useLinkRepository(),
    auth = useCurrentUser(),
    app = useNuxtApp(),
    context = useState<string>('page-content-context', () => '')
  const draft = ref<LinkSettings | null>(null),
    conflict = ref<LinkSettings | null>(null),
    recovery = ref<RulesRecovery | null>(null),
    previousRecoveries = ref<{ key: string; value: RulesRecovery }[]>([])
  const pending = ref(false),
    ready = ref(false),
    error = ref(''),
    notice = ref(''),
    baseline = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value.rules) !== baseline.value)
  let actor = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const prefix = () => `tixxin-link-rules:${actor}`,
    key = () => editorRecoveryKey(prefix(), ownedContext)
  function persist() {
    if (!import.meta.client || !actor || !draft.value || !dirty.value) return
    try {
      sessionStorage.setItem(
        key(),
        JSON.stringify({
          version: 1,
          context: ownedContext,
          rules: draft.value.rules,
          savedAt: new Date().toISOString(),
        }),
      )
    } catch {
      error.value = '须知恢复副本保存失败，请保留当前输入。'
    }
  }
  async function load() {
    if (pending.value) return
    persist()
    const version = ++generation
    pending.value = true
    error.value = ''
    try {
      if (!(await auth.restore())) throw new Error('请先登录博主账号。')
      const user = auth.currentUser.value!.id,
        startedContext = context.value
      if (!alive || generation !== version) return
      actor = user
      ownedContext = startedContext
      const copies = readEditorRecoveries(sessionStorage, prefix(), ownedContext, parseRulesRecovery)
      recovery.value = copies.current?.value ?? null
      previousRecoveries.value = copies.previous
      if (copies.migrationIssue) error.value = '旧须知副本迁移暂未完成，原副本已保留。'
      const value = await repo.settings()
      if (!alive || generation !== version || auth.currentUser.value?.id !== user || context.value !== startedContext)
        return
      draft.value = value
      baseline.value = JSON.stringify(value.rules)
      conflict.value = null
      ready.value = true
    } catch (cause) {
      if (alive && generation === version) error.value = cause instanceof Error ? cause.message : '友链须知读取失败'
    } finally {
      if (alive && generation === version) pending.value = false
    }
  }
  async function save() {
    if (!draft.value || pending.value || !ready.value || !dirty.value) return
    const user = auth.currentUser.value?.id,
      version = generation
    if (!user || user !== actor || context.value !== ownedContext) return
    persist()
    pending.value = true
    error.value = ''
    notice.value = ''
    const owns = () =>
      alive && generation === version && auth.currentUser.value?.id === user && context.value === ownedContext
    try {
      const value = await repo.saveSettings({ rules: [...draft.value.rules], revision: draft.value.revision })
      if (!owns()) return
      draft.value = value
      baseline.value = JSON.stringify(value.rules)
      conflict.value = null
      recovery.value = null
      try {
        sessionStorage.removeItem(key())
      } catch {
        error.value = '须知已保存，但本机恢复副本暂时无法清理。'
      }
      notice.value = '友链须知已保存。'
      void app.runWithContext(() => refreshNuxtData('links-metadata'))
    } catch (cause) {
      if (!owns()) return
      error.value = cause instanceof Error ? cause.message : '保存失败，输入已保留'
      if ((cause as { statusCode?: number }).statusCode === 409) {
        try {
          const latest = await repo.settings()
          if (owns()) conflict.value = latest
        } catch {
          /* 保留当前输入和原错误。 */
        }
      }
    } finally {
      if (owns()) pending.value = false
    }
  }
  function restore() {
    if (draft.value && recovery.value && ready.value && !pending.value && recovery.value.context === ownedContext) {
      draft.value.rules = [...recovery.value.rules]
      recovery.value = null
    }
  }
  function merge() {
    if (draft.value && conflict.value && !pending.value) {
      draft.value.revision = conflict.value.revision
      conflict.value = null
      notice.value = '已保留输入，请核对后按最新版本保存。'
    }
  }
  const unload = (event: BeforeUnloadEvent) => {
    if (dirty.value || pending.value) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  watch(draft, persist, { deep: true })
  watch(
    () => auth.currentUser.value?.id,
    (next) => {
      if (actor && next !== actor) {
        persist()
        generation++
        pending.value = false
        ready.value = false
        if (next) {
          draft.value = null
          recovery.value = null
          previousRecoveries.value = []
          conflict.value = null
          actor = ''
          void load()
        }
      } else if (next && !ready.value && !pending.value) {
        if (draft.value && ownedContext === context.value) ready.value = true
        else void load()
      }
    },
  )
  watch(context, () => {
    if (actor && context.value !== ownedContext) {
      persist()
      generation++
      ready.value = false
      pending.value = false
      error.value = '内容库已恢复或切换，请重新读取并核对须知，旧输入已保留。'
    }
  })
  onMounted(() => {
    void load()
    window.addEventListener('beforeunload', unload)
  })
  onBeforeRouteLeave(() => {
    if (pending.value) return false
    if (!dirty.value) return true
    persist()
    return window.confirm('须知尚未保存，已保留本标签页副本，确定离开吗？')
  })
  onScopeDispose(() => {
    persist()
    alive = false
    generation++
    if (import.meta.client) window.removeEventListener('beforeunload', unload)
  })
  return {
    draft,
    conflict,
    recovery,
    previousRecoveries,
    pending,
    ready,
    error,
    notice,
    dirty,
    load,
    save,
    restore,
    merge,
    persist,
  }
}
