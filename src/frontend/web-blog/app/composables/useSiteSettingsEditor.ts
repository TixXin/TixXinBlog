/**
 * @file useSiteSettingsEditor.ts
 * @description 站点设置编辑、失败保留、版本冲突与历史恢复。
 */
import type { SiteSettingsData } from '~/features/site/settings'
import { emptyAbout, publicAbout, aboutSectionLabel, aboutSectionLabelKeys } from '~/features/about/settings'
import {
  mergeSiteSettings,
  normalizeSiteSettings,
  parseSiteSettingsRecovery,
  sameSiteValues,
} from '~/features/site/editor'
import type { SiteSettingsCopy, SiteSettingsRecovery } from '~/features/site/editor'
export function useSiteSettingsEditor() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const publicSite = useSiteSettings()
  const toast = useToast()
  const { t } = useI18n()
  const S = 'admin-system.site.editor'
  const context = useState<string>('page-content-context', () => '')
  const ready = ref(false)
  let actor = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const owns = (version: number) =>
    alive && generation === version && actor === auth.currentUser.value?.id && ownedContext === context.value
  const recoveryKey = () => `blog-site-settings:${actor}:${ownedContext}`
  const conflictLabels = (paths: string[]) => {
    const fields = [
      'name',
      'description',
      'ownerName',
      'ownerTitle',
      'avatar',
      'avatarAlt',
      'seoTitle',
      'seoDescription',
      'announcement',
      'socials',
      'presenceLabel',
      'presenceSignature',
      'launchedAt',
      'presenceStatus',
      'navigation',
      'footerLinks',
      'quotes',
      'icpNumber',
      'icpUrl',
      'copyright',
    ]
    const labels: Record<string, string> = {
      ...Object.fromEntries(fields.map((field) => [field, t(`${S}.fields.${field}`)])),
      'about.visible': t(`${S}.fields.aboutVisible`),
      'about.introduction': t(`${S}.fields.aboutIntroduction`),
      'about.sections.order': t(`${S}.fields.aboutOrder`),
      ...Object.fromEntries(
        (Object.keys(aboutSectionLabelKeys) as (keyof typeof aboutSectionLabelKeys)[]).map((kind) => [
          `about.${kind}`,
          t(`${S}.fields.aboutSection`, { section: aboutSectionLabel(kind, t) }),
        ]),
      ),
    }
    return paths.map((path) => labels[path] ?? t(`${S}.fields.fallback`)).join(t(`${S}.fields.separator`))
  }
  let unreadableRecovery = false
  const draft = ref<SiteSettingsData | null>(null)
  const conflict = ref<SiteSettingsData | null>(null)
  const historical = ref<SiteSettingsData | null>(null)
  const preserved = ref<SiteSettingsData | null>(null)
  const preservedBase = ref<SiteSettingsData | null>(null)
  const submission = ref<SiteSettingsCopy | null>(null)
  const pending = ref(false)
  const error = ref('')
  const baseline = ref('')
  const history = ref<{ revision: number; reason: string; createdAt: string }[]>([])
  const historyPage = ref(1)
  const historyTotal = ref(0)
  const historyPending = ref(false)
  const historyError = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
  const clone = (value: SiteSettingsData) => structuredClone(toRaw(value))
  function persist() {
    if (!import.meta.client || !actor || !draft.value || !baseline.value) return
    if (unreadableRecovery) {
      error.value = t(`${S}.recoveryLocked`)
      return
    }
    try {
      if (!dirty.value && !preserved.value && !submission.value) sessionStorage.removeItem(recoveryKey())
      else
        sessionStorage.setItem(
          recoveryKey(),
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
  function readRecovery() {
    try {
      const raw = sessionStorage.getItem(recoveryKey())
      if (!raw || !draft.value) return
      const value = parseSiteSettingsRecovery(raw)
      if (!value) {
        unreadableRecovery = true
        error.value = t(`${S}.recoveryInvalid`)
        return
      }
      // 保留原始基线；用户载入时再展示同字段竞争，不能预先静默覆盖最新配置。
      const copy = !sameSiteValues(value.draft, value.baseline)
        ? { draft: value.draft, base: value.baseline }
        : value.preserved
      preserved.value = copy?.draft ?? null
      preservedBase.value = copy?.base ?? null
      submission.value = value.submission
      if (submission.value) error.value = t(`${S}.submissionPendingOnLoad`)
    } catch {
      error.value = t(`${S}.recoveryUnreadable`)
    }
  }
  function accept(value: SiteSettingsData) {
    const normalized = normalizeSiteSettings(value)
    draft.value = normalized
    baseline.value = JSON.stringify(normalized)
    conflict.value = null
    publicSite.accept({ ...clone(normalized), about: publicAbout(normalized.about) })
  }
  async function load() {
    if (!alive || pending.value) return
    persist()
    const version = ++generation
    ready.value = false
    historyPending.value = false
    pending.value = true
    error.value = ''
    unreadableRecovery = false
    try {
      if (!(await auth.restore())) throw new Error('请先登录')
      if (!alive || version !== generation) return
      actor = auth.currentUser.value!.id
      ownedContext = context.value
      const value = await api<SiteSettingsData>('/admin/site')
      if (!owns(version)) return
      accept(value)
      readRecovery()
      ready.value = true
    } catch {
      if (alive && version === generation) error.value = t(`${S}.loadFailed`)
    } finally {
      if (alive && version === generation) pending.value = false
    }
  }
  async function loadHistory(page = historyPage.value) {
    if (historyPending.value || !ready.value || !owns(generation)) return
    const version = generation
    historyPending.value = true
    historyError.value = ''
    try {
      const result = await api<{ items: typeof history.value; total: number }>('/admin/site/revisions', {
        query: { page },
      })
      if (!owns(version)) return
      history.value = result.items
      historyTotal.value = result.total
      historyPage.value = page
    } catch {
      if (owns(version)) historyError.value = t(`${S}.historyFailed`)
    } finally {
      if (owns(version)) historyPending.value = false
    }
  }
  async function write(path: string, method: 'PATCH' | 'POST', body: unknown, expected: SiteSettingsData) {
    if (pending.value || submission.value || conflict.value || !ready.value || !draft.value || !owns(generation)) return
    const version = generation
    const input = clone(draft.value)
    submission.value = { draft: clone(expected), base: JSON.parse(baseline.value) as SiteSettingsData }
    persist()
    pending.value = true
    error.value = ''
    try {
      const value = await api<SiteSettingsData>(path, { method, body })
      if (!owns(version)) return
      const current = clone(draft.value!)
      accept(value)
      // 请求正文已冻结，迟到的成功响应也不能抹掉请求开始后产生的新输入。
      draft.value = mergeSiteSettings(input, current, clone(draft.value!)).merged
      submission.value = null
      persist()
      toast.success(t(`${S}.saved`))
      await loadHistory(1)
    } catch (cause) {
      if (!owns(version)) return
      const status = (cause as { statusCode?: number }).statusCode
      if (status && status >= 400 && status < 500 && status !== 408) submission.value = null
      error.value = submission.value
        ? t(`${S}.submissionUnconfirmed`)
        : apiErrorMessage(cause, `${S}.saveFailed`, { t })
      if (status === 409) {
        try {
          const latest = await api<SiteSettingsData>('/admin/site')
          if (owns(version)) conflict.value = latest
        } catch {
          if (owns(version)) error.value += t(`${S}.latestFailedSuffix`)
        }
      }
      persist()
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function save() {
    if (!draft.value) return
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...body } = draft.value
    await write('/admin/site', 'PATCH', body, clone(draft.value))
  }
  async function checkSubmission() {
    if (!submission.value || pending.value || !ready.value || !owns(generation)) return
    const version = generation
    pending.value = true
    try {
      const latest = await api<SiteSettingsData>('/admin/site')
      if (!owns(version)) return
      if (sameSiteValues(submission.value!.draft, latest)) {
        const current = clone(draft.value!)
        const sent = clone(submission.value!.draft)
        const prior = clone(submission.value!.base)
        accept(latest)
        // 刷新后编辑器仍是服务器资料；原提交副本已生效时无需再提供重复恢复。
        if (preserved.value && sameSiteValues(preserved.value, sent)) {
          preserved.value = null
          preservedBase.value = null
        }
        if (!sameSiteValues(current, prior) && !sameSiteValues(current, latest))
          draft.value = mergeSiteSettings(sent, current, clone(draft.value!)).merged
        error.value = t(`${S}.submissionConfirmed`)
      } else {
        conflict.value = normalizeSiteSettings(latest)
        error.value = t(`${S}.submissionDiffers`)
      }
      submission.value = null
      persist()
    } catch {
      if (owns(version)) error.value = t(`${S}.submissionStillUnknown`)
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function inspect(revision: number) {
    if (historyPending.value || !ready.value || !owns(generation)) return
    const version = generation
    historyPending.value = true
    historyError.value = ''
    try {
      const value = await api<SiteSettingsData>(`/admin/site/revisions/${revision}`)
      if (owns(version)) historical.value = { ...value, about: value.about ?? emptyAbout() }
    } catch {
      if (owns(version)) historyError.value = t(`${S}.revisionFailed`)
    } finally {
      if (owns(version)) historyPending.value = false
    }
  }
  function loadHistorical() {
    if (!historical.value || !draft.value || pending.value || submission.value || !owns(generation)) return
    if (dirty.value) {
      preserved.value = clone(draft.value)
      preservedBase.value = JSON.parse(baseline.value) as SiteSettingsData
    }
    draft.value = { ...clone(historical.value), revision: draft.value.revision, updatedAt: draft.value.updatedAt }
    historical.value = null
  }
  async function restoreHistorical() {
    if (!historical.value || !draft.value || pending.value || submission.value || !owns(generation)) return
    if (!window.confirm(t(`${S}.restoreConfirm`, { revision: historical.value.revision }))) return
    if (dirty.value) {
      preserved.value = clone(draft.value)
      preservedBase.value = JSON.parse(baseline.value) as SiteSettingsData
    }
    await write(
      `/admin/site/revisions/${historical.value.revision}/restore`,
      'POST',
      {
        revision: draft.value.revision,
      },
      { ...clone(historical.value), revision: draft.value.revision },
    )
  }
  function mergeConflict() {
    if (!conflict.value || !draft.value || pending.value || submission.value || !owns(generation)) return
    const result = mergeSiteSettings(
      JSON.parse(baseline.value) as SiteSettingsData,
      clone(draft.value),
      clone(conflict.value),
    )
    if (
      result.conflicts.length &&
      !window.confirm(t(`${S}.mergeConfirm`, { fields: conflictLabels(result.conflicts) }))
    )
      return
    baseline.value = JSON.stringify(conflict.value)
    draft.value = result.merged
    conflict.value = null
    error.value = t(`${S}.merged`)
    persist()
  }
  function recoverPreserved() {
    if (
      !preserved.value ||
      !preservedBase.value ||
      !draft.value ||
      pending.value ||
      submission.value ||
      !ready.value ||
      !owns(generation)
    )
      return
    const current = clone(draft.value)
    const result = mergeSiteSettings(clone(preservedBase.value), clone(preserved.value), current)
    if (
      result.conflicts.length &&
      !window.confirm(t(`${S}.recoverConfirm`, { fields: conflictLabels(result.conflicts) }))
    )
      return
    draft.value = result.merged
    preserved.value = current
    preservedBase.value = JSON.parse(baseline.value) as SiteSettingsData
    persist()
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value || pending.value) {
      persist()
      event.preventDefault()
      event.returnValue = ''
    }
  }
  watch(
    draft,
    () => {
      if (ready.value) persist()
    },
    { deep: true, flush: 'sync' },
  )
  watch(
    [() => auth.currentUser.value?.id, context],
    () => {
      if (!actor || (actor === auth.currentUser.value?.id && ownedContext === context.value)) return
      persist()
      generation++
      ready.value = false
      pending.value = false
      historyPending.value = false
      draft.value = null
      conflict.value = null
      historical.value = null
      preserved.value = null
      history.value = []
      submission.value = null
      preservedBase.value = null
      baseline.value = ''
      actor = ''
      ownedContext = ''
      unreadableRecovery = false
      error.value = t(`${S}.contextChanged`)
    },
    { flush: 'sync' },
  )
  onBeforeRouteLeave(() => !pending.value && (!dirty.value || window.confirm(t(`${S}.leaveConfirm`))))
  onMounted(async () => {
    window.addEventListener('beforeunload', beforeUnload)
    const restored = await auth.restore()
    if (!alive) return
    if (restored) {
      await load()
      await loadHistory()
    } else await navigateTo('/admin/login?next=/admin/site')
  })
  onBeforeUnmount(() => {
    persist()
    alive = false
    generation++
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return {
    draft,
    ready,
    conflict,
    historical,
    preserved,
    submission,
    checkSubmission,
    pending,
    error,
    dirty,
    history,
    historyPage,
    historyTotal,
    historyPending,
    historyError,
    load,
    save,
    loadHistory,
    inspect,
    loadHistorical,
    restoreHistorical,
    mergeConflict,
    recoverPreserved,
  }
}
