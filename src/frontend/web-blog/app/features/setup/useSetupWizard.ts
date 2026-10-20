/**
 * @file useSetupWizard.ts
 * @description 初始化向导的状态与流程：读取并移除地址中的令牌、确认开放状态、两步校验、提交与错误分派
 *              （404 已关闭、403 令牌被拒回到第一步）、成功后自动登录；开发模式下留空提交填入示例数据。
 *              切换步骤与字段聚焦涉及 DOM，由页面以回调传入
 * @author TixXin
 * @since 2026-10-20
 */
import type { Ref } from 'vue'
import type { SupportedLocale } from '~~/i18n/localeOptions'
import { drawLetterAvatar } from './avatar'
import { DEV_SETUP_ACCOUNT, devAccountSample, devProfileSample, isProfileUntouched } from './devSample'
import { SETUP_PASSWORD_MAX_LENGTH, SETUP_PASSWORD_MIN_LENGTH } from './password'
import { createProfileDraft, profileRequest, validateProfile } from './profile'
import type { SetupProfileField, SetupProfileProblem } from './profile'
import type { SetupAccountField, SetupPhase, SetupRequest } from './types'

interface WizardOptions {
  step: Ref<1 | 2>
  /** 带动画切换步骤，不移动焦点（出错回到第一步时由校验聚焦字段） */
  switchStep: (target: 1 | 2) => Promise<void>
  /** 带动画切换步骤并把焦点交给标题 */
  goTo: (target: 1 | 2) => Promise<void>
  focusAccount: (field: SetupAccountField, select?: boolean) => Promise<void>
  focusProfile: (field: SetupProfileField) => Promise<void>
}

export function useSetupWizard({ step, switchStep, goTo, focusAccount, focusProfile }: WizardOptions) {
  const { t, locale } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const fetchSetupStatus = useSetupStatus()
  const { login } = useCurrentUser()
  const siteSettings = useSiteSettings()
  const { success, info } = useToast()
  const { switchLocale } = useLocaleSwitch()
  // 开发预览：?preview=form|closed|error 强制显示对应状态，提交不请求接口；生产构建中恒为 null
  const preview = useDevPreview()
  const previewPhase = computed<SetupPhase | null>(() =>
    preview('form') ? 'open' : preview('closed') ? 'closed' : preview('error') ? 'error' : null,
  )

  const phase = ref<SetupPhase>('checking')
  const token = ref('')
  const tokenFromLink = ref(false)
  const tokenRejected = ref(false)
  const username = ref('')
  const password = ref('')
  const confirmation = ref('')
  const siteLocale = ref<SupportedLocale>(locale.value === 'en' ? 'en' : 'zh-CN')
  const submitting = ref(false)
  const error = ref('')
  const fieldError = ref<{ field: SetupAccountField; message: string } | null>(null)
  const profile = ref(createProfileDraft())
  const profileError = ref<{ field: SetupProfileField; message: string } | null>(null)

  const showToken = computed(() => !tokenFromLink.value || tokenRejected.value)
  // 站点名称留空时后端沿用当前名称，占位直接显示它，避免把示例误当默认值
  const currentSiteName = computed(() => siteSettings.settings.value.name)
  // 字母头像按博主名（留空时取登录名）绘制；画布不可用时不提交头像
  const letterAvatar = computed(() => {
    if (step.value !== 2 || profile.value.avatarMode !== 'letter') return ''
    try {
      return drawLetterAvatar(profile.value.ownerName.trim() || username.value)
    } catch {
      return ''
    }
  })

  // 选择站点语言时同步切换本页界面语言（与访客语言切换共用 cookie），已显示的错误按旧语言生成，一并清除
  watch(siteLocale, (code) => {
    error.value = ''
    fieldError.value = null
    void switchLocale(code)
  })
  // 修改出错字段后清除它的提示，避免旧错误停留在已更正的输入框下
  watch([token, username, password, confirmation], () => (fieldError.value = null))
  watch(profile, () => (profileError.value = null), { deep: true })
  // 表单出现后聚焦第一个待填字段：令牌已带入时直接从登录名开始
  watch(phase, (value) => {
    if (value === 'open') void focusAccount(showToken.value ? 'token' : 'username')
  })

  function validate(): { field: SetupAccountField; message: string } | null {
    if (!token.value) return { field: 'token', message: t('admin-system.setup.tokenMissing') }
    if (!username.value) return { field: 'username', message: t('admin-system.setup.usernameHelp') }
    if (password.value.length < SETUP_PASSWORD_MIN_LENGTH)
      return { field: 'password', message: t('admin-system.setup.tooShort', { min: SETUP_PASSWORD_MIN_LENGTH }) }
    if (password.value.length > SETUP_PASSWORD_MAX_LENGTH)
      return { field: 'password', message: t('admin-system.setup.tooLong', { max: SETUP_PASSWORD_MAX_LENGTH }) }
    if (password.value !== confirmation.value) return { field: 'confirm', message: t('admin-system.setup.mismatch') }
    return null
  }

  async function checkAccount(): Promise<boolean> {
    const problem = validate()
    if (!problem) return true
    if (problem.field === 'token') tokenRejected.value = true
    await switchStep(1)
    fieldError.value = problem
    await focusAccount(problem.field)
    return false
  }

  /** 接口拒绝令牌（403）：回到第一步展开令牌输入框并在框下提示，聚焦并全选旧令牌 */
  async function rejectToken(message: string) {
    tokenRejected.value = true
    await switchStep(1)
    fieldError.value = { field: 'token', message }
    await focusAccount('token', true)
  }

  async function profileFailed(field: SetupProfileField, problem: SetupProfileProblem) {
    await nextTick()
    profileError.value = { field, message: t(`admin-system.setup.profile.problem.${problem}`) }
    await focusProfile(field)
  }

  /**
   * 开发模式：第一步三项全空时填入示例账号，第二步仍为默认值时填入示例资料；只填空白，不覆盖手动输入。
   * 生产构建中 import.meta.dev 为 false，调用处整段被剔除
   */
  function fillDevSample() {
    if (step.value === 1) {
      const sample = devAccountSample({
        username: username.value,
        password: password.value,
        confirmation: confirmation.value,
      })
      if (!sample) return
      username.value = sample.username
      password.value = sample.password
      confirmation.value = sample.confirmation
      info(`开发模式：已填入示例账号 ${DEV_SETUP_ACCOUNT.username} / ${DEV_SETUP_ACCOUNT.password}`)
    } else if (isProfileUntouched(profile.value)) {
      profile.value = devProfileSample(profile.value, siteLocale.value)
      info('开发模式：已填入示例博主资料')
    }
  }

  /** 第一步校验账号字段后进入第二步；第二步提交全部资料 */
  async function onSubmit() {
    if (import.meta.dev) fillDevSample()
    if (step.value === 2) return submit(true)
    if (!(await checkAccount())) return
    error.value = ''
    await goTo(2)
  }

  async function back() {
    error.value = ''
    await goTo(1)
  }

  /** 创建成功：重读站点资料（向导可能改了名称），再用同一凭据登录进入后台；登录失败时退回登录页 */
  async function enter(body: SetupRequest) {
    token.value = password.value = confirmation.value = ''
    await Promise.resolve(siteSettings.refresh()).catch(() => {})
    try {
      await login(body.username, body.password)
      success(t('admin-system.setup.successSignedIn'))
      await navigateTo('/admin')
    } catch {
      success(t('admin-system.setup.success'))
      await navigateTo({ path: '/admin/login', query: { setup: 'done' } })
    }
  }

  /** withProfile 为 false 时即「跳过」：只提交账号与站点语言 */
  async function submit(withProfile: boolean) {
    if (submitting.value) return
    error.value = ''
    if (!(await checkAccount())) return
    const problem = withProfile ? validateProfile(profile.value) : null
    if (problem) return profileFailed(problem.field, problem.problem)
    if (previewPhase.value) {
      // 预览只检验前端校验与提示样式；&preview-submit=fail 模拟接口拒绝令牌时的展示
      if (route.query['preview-submit'] === 'fail') await rejectToken(t('admin-system.setup.previewFailed'))
      else success(t('admin-system.setup.previewSubmitted'))
      return
    }
    const context = { username: username.value, locale: siteLocale.value, letterImage: letterAvatar.value }
    const body: SetupRequest = {
      token: token.value,
      username: username.value,
      password: password.value,
      locale: siteLocale.value,
      ...(withProfile ? profileRequest(profile.value, context) : {}),
    }
    submitting.value = true
    try {
      await $fetch('/api/v1/setup', { method: 'POST', body, retry: 0, timeout: 15000 })
    } catch (cause) {
      submitting.value = false
      const status = (cause as { statusCode?: number } | null)?.statusCode
      // 404 表示站点已完成初始化（含并发提交中另一方先成功），不再显示表单；403 为令牌不对。
      if (status === 404) phase.value = 'closed'
      else if (status === 403) await rejectToken(apiErrorMessage(cause, 'admin-system.setup.failed'))
      else error.value = apiErrorMessage(cause, 'admin-system.setup.failed')
      return
    }
    try {
      await enter(body)
    } finally {
      submitting.value = false
    }
  }

  /** 读取地址中的令牌后用 replace 去掉，不留在地址栏和浏览历史里；其余查询参数保留 */
  async function takeTokenFromUrl() {
    const value = route.query.token
    if (value === undefined) return
    if (typeof value === 'string' && value.trim()) {
      token.value = value.trim()
      tokenFromLink.value = true
    }
    const rest = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'token'))
    await router.replace({ path: route.path, query: rest, hash: route.hash })
  }

  async function check() {
    if (previewPhase.value) {
      phase.value = previewPhase.value
      if (!token.value) {
        token.value = 'a'.repeat(48)
        tokenFromLink.value = true
      }
      return
    }
    phase.value = 'checking'
    try {
      phase.value = (await fetchSetupStatus()) ? 'open' : 'closed'
    } catch {
      phase.value = 'error'
    }
  }

  onMounted(async () => {
    await takeTokenFromUrl()
    await check()
  })
  // 调试面板在同一页面切换或退出预览时只改地址参数，需要重新判定状态
  if (import.meta.dev) {
    watch(previewPhase, () => {
      error.value = ''
      fieldError.value = null
      step.value = 1
      void check()
    })
  }
  onBeforeUnmount(() => {
    token.value = password.value = confirmation.value = ''
  })

  return {
    phase,
    token,
    showToken,
    username,
    password,
    confirmation,
    siteLocale,
    submitting,
    error,
    fieldError,
    profile,
    profileError,
    currentSiteName,
    letterAvatar,
    check,
    onSubmit,
    back,
    skip: () => submit(false),
    profileFailed,
  }
}
