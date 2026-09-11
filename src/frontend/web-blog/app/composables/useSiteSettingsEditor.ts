/**
 * @file useSiteSettingsEditor.ts
 * @description 站点设置编辑、失败保留、版本冲突与历史恢复。
 */
import type { SiteSettingsData } from '~/features/site/settings'
import { emptyAbout, publicAbout, aboutSectionLabels } from '~/features/about/settings'
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
  const context = useState<string>('page-content-context', () => '')
  const ready = ref(false)
  let actor = '',
    ownedContext = '',
    generation = 0,
    alive = true
  const owns = (version: number) =>
    alive && generation === version && actor === auth.currentUser.value?.id && ownedContext === context.value
  const recoveryKey = () => `tixxin-site-settings:${actor}:${ownedContext}`
  const conflictLabels = (paths: string[]) => {
    const labels: Record<string, string> = {
      name: '站点名称',
      description: '站点简介',
      ownerName: '博主名称',
      ownerTitle: '博主简介',
      avatar: '头像地址',
      avatarAlt: '头像替代文本',
      seoTitle: '首页 SEO 标题',
      seoDescription: '默认 SEO 描述',
      announcement: '站点公告',
      socials: '社交链接',
      'about.visible': '关于资料显隐',
      'about.introduction': '详细介绍',
      'about.sections.order': '关于栏目顺序',
      ...Object.fromEntries(
        Object.entries(aboutSectionLabels).map(([kind, label]) => [`about.${kind}`, `${label}栏目`]),
      ),
    }
    return paths.map((path) => labels[path] ?? '站点资料').join('、')
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
      error.value = '原恢复副本格式不完整，已保留；当前新输入无法写入恢复副本，请先保留当前页面。'
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
      error.value = '恢复副本无法保存，请保留当前页面。'
    }
  }
  function readRecovery() {
    try {
      const raw = sessionStorage.getItem(recoveryKey())
      if (!raw || !draft.value) return
      const value = parseSiteSettingsRecovery(raw)
      if (!value) {
        unreadableRecovery = true
        error.value = '此前恢复副本格式不完整，未载入；原副本仍保留。'
        return
      }
      // 保留原始基线；用户载入时再展示同字段竞争，不能预先静默覆盖最新配置。
      const copy = !sameSiteValues(value.draft, value.baseline)
        ? { draft: value.draft, base: value.baseline }
        : value.preserved
      preserved.value = copy?.draft ?? null
      preservedBase.value = copy?.base ?? null
      submission.value = value.submission
      if (submission.value) error.value = '此前提交结果尚未确认，请先核对服务器结果；当前不会重复提交。'
    } catch {
      error.value = '此前恢复副本无法读取，服务器资料仍可正常编辑。'
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
      if (alive && version === generation) error.value = '站点设置读取失败，请重试'
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
      if (owns(version)) historyError.value = '配置历史读取失败'
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
      toast.success('站点资料已生效')
      await loadHistory(1)
    } catch (cause) {
      if (!owns(version)) return
      const message = (cause as { data?: { message?: unknown } }).data?.message
      const status = (cause as { statusCode?: number }).statusCode
      if (status && status >= 400 && status < 500 && status !== 408) submission.value = null
      error.value = submission.value
        ? '提交结果尚未确认，请先核对服务器结果；当前输入仍保留。'
        : typeof message === 'string'
          ? message
          : '保存失败，当前输入仍保留'
      if (status === 409) {
        try {
          const latest = await api<SiteSettingsData>('/admin/site')
          if (owns(version)) conflict.value = latest
        } catch {
          if (owns(version)) error.value += '；最新版本读取失败，请稍后重试'
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
        error.value = '服务器已包含此次提交的资料，已确认当前版本。'
      } else {
        conflict.value = normalizeSiteSettings(latest)
        error.value = '服务器资料与提交内容不同，请比较最新资料并明确合并后再保存。'
      }
      submission.value = null
      persist()
    } catch {
      if (owns(version)) error.value = '提交结果仍无法确认，请稍后继续核对；不会自动重试写入。'
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
      if (owns(version)) historyError.value = '历史配置读取失败'
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
    if (
      !window.confirm(
        `立即将站点公开资料恢复到版本 ${historical.value.revision}？这会生成新版本，未保存输入会先保留在当前页面。`,
      )
    )
      return
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
      !window.confirm(
        `以下字段同时被修改：${conflictLabels(result.conflicts)}。继续使用当前输入覆盖这些字段，并保留服务器其他改动？`,
      )
    )
      return
    baseline.value = JSON.stringify(conflict.value)
    draft.value = result.merged
    conflict.value = null
    error.value = '已合并当前改动并保留服务器其他配置，请核对后保存'
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
      !window.confirm(`恢复副本与当前资料同时修改了：${conflictLabels(result.conflicts)}。确认采用恢复副本的这些字段？`)
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
      error.value = '账号或内容库已改变，请重新读取站点资料。此前输入按原账号与内容库保留。'
    },
    { flush: 'sync' },
  )
  onBeforeRouteLeave(() => !pending.value && (!dirty.value || window.confirm('站点资料尚未保存，确定离开吗？')))
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
