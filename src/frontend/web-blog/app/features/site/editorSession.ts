/** @file editorSession.ts @description 站点设置编辑器的会话状态：账号与内容库归属、请求代次、恢复副本写入与服务器结果接受 */
import type { SiteSettingsData } from './settings'
import { publicAbout } from '../about/settings'
import { normalizeSiteSettings } from './editor'
import type { SiteSettingsCopy, SiteSettingsRecovery } from './editor'
import { SITE_EDITOR_I18N as S } from './editorLabels'

export type SiteRevisionItem = { revision: number; reason: string; createdAt: string }

/** 编辑器的全部响应式状态；dirty 以 JSON 文本比对草稿与基线 */
function createSiteEditorState() {
  const ready = ref(false)
  const draft = ref<SiteSettingsData | null>(null)
  const conflict = ref<SiteSettingsData | null>(null)
  const historical = ref<SiteSettingsData | null>(null)
  const preserved = ref<SiteSettingsData | null>(null)
  const preservedBase = ref<SiteSettingsData | null>(null)
  const submission = ref<SiteSettingsCopy | null>(null)
  const pending = ref(false)
  const error = ref('')
  const baseline = ref('')
  const history = ref<SiteRevisionItem[]>([])
  const historyPage = ref(1)
  const historyTotal = ref(0)
  const historyPending = ref(false)
  const historyError = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
  return {
    ready,
    draft,
    conflict,
    historical,
    preserved,
    preservedBase,
    submission,
    pending,
    error,
    baseline,
    history,
    historyPage,
    historyTotal,
    historyPending,
    historyError,
    dirty,
  }
}

export function createSiteEditorSession() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const publicSite = useSiteSettings()
  const toast = useToast()
  const { t } = useI18n()
  const context = useState<string>('page-content-context', () => '')
  const state = createSiteEditorState()
  /** 会话归属与请求代次：换账号、换内容库或卸载后，旧请求的结果一律丢弃 */
  const session = { actor: '', ownedContext: '', generation: 0, alive: true, unreadableRecovery: false }
  const owns = (version: number) =>
    session.alive &&
    session.generation === version &&
    session.actor === auth.currentUser.value?.id &&
    session.ownedContext === context.value
  const recoveryKey = () => `blog-site-settings:${session.actor}:${session.ownedContext}`
  const clone = (value: SiteSettingsData) => structuredClone(toRaw(value))
  const s = { ...state, api, auth, publicSite, toast, t, context, session, owns, recoveryKey, clone }
  const persist = () => persistSiteRecovery(s)
  function accept(value: SiteSettingsData) {
    const normalized = normalizeSiteSettings(value)
    state.draft.value = normalized
    state.baseline.value = JSON.stringify(normalized)
    state.conflict.value = null
    publicSite.accept({ ...clone(normalized), about: publicAbout(normalized.about) })
  }
  return { ...s, persist, accept }
}

type SessionCore = Omit<ReturnType<typeof createSiteEditorSession>, 'persist' | 'accept'>
export type SiteEditorSession = ReturnType<typeof createSiteEditorSession>

/** 本标签页恢复副本：无改动且无保留或未确认提交时删除，否则整份写入 */
function persistSiteRecovery(s: SessionCore) {
  const { session, draft, baseline, preserved, preservedBase, submission, error, t } = s
  if (!import.meta.client || !session.actor || !draft.value || !baseline.value) return
  if (session.unreadableRecovery) {
    error.value = t(`${S}.recoveryLocked`)
    return
  }
  try {
    if (!s.dirty.value && !preserved.value && !submission.value) sessionStorage.removeItem(s.recoveryKey())
    else
      sessionStorage.setItem(
        s.recoveryKey(),
        JSON.stringify({
          version: 1,
          draft: draft.value,
          baseline: JSON.parse(baseline.value),
          preserved:
            preserved.value && preservedBase.value ? { draft: preserved.value, base: preservedBase.value } : null,
          submission: submission.value,
        } satisfies SiteSettingsRecovery),
      )
  } catch {
    error.value = t(`${S}.recoverySaveFailed`)
  }
}
