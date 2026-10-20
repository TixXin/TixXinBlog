<!--
  @file setup.vue
  @description 浏览器初始化向导：凭安装时生成的一次性令牌创建首个博主账号；地址中的令牌读取后立即移除，
               页面不进入 SSR 缓存、不被索引、不发送 Referer，账号创建后后端永久关闭该入口
-->
<template>
  <div class="setup-page">
    <section class="setup" aria-labelledby="setup-title" :aria-busy="phase === 'checking'">
      <header class="setup__head">
        <img class="setup__mark" src="/icon.svg" alt="" width="44" height="44" />
        <h1 id="setup-title">{{ t('admin-system.setup.welcome') }}</h1>
        <p class="setup__intro">{{ t('admin-system.setup.intro') }}</p>
      </header>
      <!-- 确认状态期间先占出表单轮廓，避免加载完成后卡片高度突变 -->
      <div v-if="phase === 'checking'" class="setup-skeleton" role="status">
        <span class="sr-only">{{ t('admin-system.setup.checking') }}</span>
        <div v-for="index in 4" :key="index" class="setup-skeleton__field" aria-hidden="true">
          <span class="setup-skeleton__label" />
          <span class="setup-skeleton__input" />
        </div>
        <span class="setup-skeleton__button" aria-hidden="true" />
      </div>
      <div v-else-if="phase === 'closed'" class="setup__notice" role="status">
        <p>{{ t('admin-system.setup.unavailable') }}</p>
        <NuxtLink to="/admin/login" class="btn-primary setup__action"
          >{{ t('admin-system.setup.toLogin') }}<Icon name="lucide:arrow-right" aria-hidden="true"
        /></NuxtLink>
      </div>
      <div v-else-if="phase === 'error'" class="setup__notice" role="alert">
        <p>{{ t('admin-system.setup.statusFailed') }}</p>
        <button type="button" class="btn-primary setup__action" @click="check">
          <Icon name="lucide:rotate-cw" aria-hidden="true" />{{ t('admin-system.setup.retry') }}
        </button>
      </div>
      <form v-else class="setup__form" novalidate @submit.prevent="submit">
        <fieldset :disabled="submitting">
          <!-- 令牌随安装链接带入时不显示；链接未带或被接口拒绝时才要求手动填写 -->
          <div v-if="showToken" class="setup-field">
            <label for="setup-token">{{ t('admin-system.setup.tokenLabel') }}</label>
            <input
              id="setup-token"
              :ref="(el) => bindInput('token', el)"
              v-model.trim="token"
              class="input-field setup-input"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              maxlength="512"
              required
              :aria-invalid="invalid('token')"
              :aria-describedby="describedBy('token', 'setup-token-help')"
            />
            <p v-if="fieldError?.field === 'token'" id="setup-token-error" class="setup-field__error" role="alert">
              <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
            </p>
            <p id="setup-token-help" class="setup-field__help">{{ t('admin-system.setup.tokenHelp') }}</p>
          </div>

          <fieldset class="setup-group">
            <legend class="setup-group__title">{{ t('admin-system.setup.sectionAccount') }}</legend>
            <div class="setup-field">
              <label for="setup-username">{{ t('admin-system.setup.usernameLabel') }}</label>
              <input
                id="setup-username"
                :ref="(el) => bindInput('username', el)"
                v-model.trim="username"
                class="input-field setup-input"
                autocomplete="username"
                autocapitalize="off"
                spellcheck="false"
                maxlength="64"
                required
                :aria-invalid="invalid('username')"
                :aria-describedby="describedBy('username', 'setup-username-help')"
              />
              <p
                v-if="fieldError?.field === 'username'"
                id="setup-username-error"
                class="setup-field__error"
                role="alert"
              >
                <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
              </p>
              <p id="setup-username-help" class="setup-field__help">{{ t('admin-system.setup.usernameHelp') }}</p>
            </div>
            <div class="setup-field">
              <label for="setup-password">{{ t('admin-system.setup.passwordLabel') }}</label>
              <div class="setup-password">
                <input
                  id="setup-password"
                  :ref="(el) => bindInput('password', el)"
                  v-model="password"
                  class="input-field setup-input"
                  :type="passwordVisible ? 'text' : 'password'"
                  autocomplete="new-password"
                  :minlength="SETUP_PASSWORD_MIN_LENGTH"
                  :maxlength="SETUP_PASSWORD_MAX_LENGTH"
                  required
                  :aria-invalid="invalid('password')"
                  :aria-describedby="describedBy('password', 'setup-password-rules setup-password-tip')"
                />
                <button
                  type="button"
                  class="setup-password__toggle"
                  :aria-label="
                    passwordVisible ? t('admin-system.setup.hidePassword') : t('admin-system.setup.showPassword')
                  "
                  :aria-pressed="passwordVisible"
                  aria-controls="setup-password setup-confirm"
                  @click="passwordVisible = !passwordVisible"
                >
                  <Icon :name="passwordVisible ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
                </button>
              </div>
              <p
                v-if="fieldError?.field === 'password'"
                id="setup-password-error"
                class="setup-field__error"
                role="alert"
              >
                <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
              </p>
            </div>
            <div class="setup-field">
              <label for="setup-confirm">{{ t('admin-system.setup.confirmLabel') }}</label>
              <input
                id="setup-confirm"
                :ref="(el) => bindInput('confirm', el)"
                v-model="confirmation"
                class="input-field setup-input"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                :maxlength="SETUP_PASSWORD_MAX_LENGTH"
                required
                :aria-invalid="invalid('confirm')"
                :aria-describedby="describedBy('confirm', 'setup-password-rules')"
              />
              <p
                v-if="fieldError?.field === 'confirm'"
                id="setup-confirm-error"
                class="setup-field__error"
                role="alert"
              >
                <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
              </p>
            </div>
            <div class="setup-rules">
              <p id="setup-password-rules-title" class="sr-only">{{ t('admin-system.setup.passwordRules') }}</p>
              <ul id="setup-password-rules" aria-labelledby="setup-password-rules-title">
                <li v-for="rule in rules" :key="rule.key" :class="{ 'setup-rules__met': rule.met }">
                  <Icon :name="rule.met ? 'lucide:circle-check' : 'lucide:circle-dashed'" aria-hidden="true" />
                  <span>{{ rule.label }}</span>
                  <span class="sr-only">{{
                    rule.met ? t('admin-system.setup.ruleMet') : t('admin-system.setup.ruleUnmet')
                  }}</span>
                </li>
              </ul>
              <p id="setup-password-tip" class="setup-field__help">{{ t('admin-system.setup.passwordTip') }}</p>
            </div>
          </fieldset>

          <fieldset class="setup-group">
            <legend class="setup-group__title">{{ t('admin-system.setup.sectionSite') }}</legend>
            <div class="setup-field">
              <label for="setup-site-name">{{ t('admin-system.setup.siteNameLabel') }}</label>
              <input
                id="setup-site-name"
                v-model.trim="siteName"
                class="input-field setup-input"
                maxlength="80"
                :placeholder="currentSiteName"
                aria-describedby="setup-site-name-help"
              />
              <p id="setup-site-name-help" class="setup-field__help">
                {{ t('admin-system.setup.siteNameHelp', { name: currentSiteName }) }}
              </p>
            </div>
            <fieldset class="setup-locale" aria-describedby="setup-locale-help">
              <legend>{{ t('admin-system.setup.localeLabel') }}</legend>
              <div class="setup-locale__options">
                <label v-for="option in localeOptions" :key="option.value" class="setup-locale__option"
                  ><input v-model="siteLocale" type="radio" name="setup-locale" :value="option.value" /><span>{{
                    option.label
                  }}</span></label
                >
              </div>
              <p id="setup-locale-help" class="setup-field__help">{{ t('admin-system.setup.localeHelp') }}</p>
            </fieldset>
          </fieldset>

          <p v-if="error" id="setup-error" class="setup__error" role="alert">
            <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ error }}</span>
          </p>
          <button type="submit" class="btn-primary setup__submit" :aria-busy="submitting">
            <Icon v-if="submitting" name="lucide:loader-circle" class="setup__spin" aria-hidden="true" />
            {{ submitting ? t('admin-system.setup.submitting') : t('admin-system.setup.submit') }}
            <Icon v-if="!submitting" name="lucide:arrow-right" aria-hidden="true" />
          </button>
        </fieldset>
      </form>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { SupportedLocale } from '~~/i18n/localeOptions'
import type { SetupPhase, SetupRequest } from '~/features/setup/types'
import { SETUP_PASSWORD_MAX_LENGTH, SETUP_PASSWORD_MIN_LENGTH, setupPasswordChecks } from '~/features/setup/password'

/** 前端校验与接口拒绝能定位到的字段 */
type SetupField = 'token' | 'username' | 'password' | 'confirm'

definePageMeta({ layout: 'admin' })
const { t, locale } = useI18n()
useSeoMeta({ title: () => t('admin-system.setup.title'), robots: 'noindex, nofollow' })
// 令牌可能出现在首屏地址中：页面内的链接与资源请求都不携带来源地址。
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
const route = useRoute()
const router = useRouter()
const fetchSetupStatus = useSetupStatus()
// 开发预览：?preview=form|closed|error 强制显示对应状态，提交不请求接口；生产构建中恒为 null
const preview = useDevPreview()
const previewPhase = computed<SetupPhase | null>(() =>
  preview('form') ? 'open' : preview('closed') ? 'closed' : preview('error') ? 'error' : null,
)
const { login } = useCurrentUser()
const siteSettings = useSiteSettings()
const { success } = useToast()
const { switchLocale } = useLocaleSwitch()

const phase = ref<SetupPhase>('checking')
const token = ref('')
const tokenFromLink = ref(false)
const tokenRejected = ref(false)
const username = ref('')
const password = ref('')
const confirmation = ref('')
const siteName = ref('')
const siteLocale = ref<SupportedLocale>(locale.value === 'en' ? 'en' : 'zh-CN')
const submitting = ref(false)
const error = ref('')
const fieldError = ref<{ field: SetupField; message: string } | null>(null)
const passwordVisible = ref(false)
const inputs: Partial<Record<SetupField, HTMLInputElement>> = {}

const showToken = computed(() => !tokenFromLink.value || tokenRejected.value)
// 站点名称留空时后端沿用当前名称，占位与说明直接显示它，避免把示例误当默认值
const currentSiteName = computed(() => siteSettings.settings.value.name)
const localeOptions = computed<{ value: SupportedLocale; label: string }[]>(() => [
  { value: 'zh-CN', label: t('admin-system.setup.localeZh') },
  { value: 'en', label: t('admin-system.setup.localeEn') },
])

const rules = computed(() => {
  const checks = setupPasswordChecks(password.value, confirmation.value)
  return [
    {
      key: 'length',
      met: checks.length,
      label: t('admin-system.setup.ruleLength', { min: SETUP_PASSWORD_MIN_LENGTH, max: SETUP_PASSWORD_MAX_LENGTH }),
    },
    { key: 'match', met: checks.match, label: t('admin-system.setup.ruleMatch') },
  ]
})

function bindInput(field: SetupField, el: Element | ComponentPublicInstance | null) {
  inputs[field] = el instanceof HTMLInputElement ? el : undefined
}
function invalid(field: SetupField) {
  return fieldError.value?.field === field ? 'true' : undefined
}
function describedBy(field: SetupField, base: string) {
  return fieldError.value?.field === field ? `setup-${field}-error ${base}` : base
}
async function focusField(field: SetupField) {
  await nextTick()
  inputs[field]?.focus()
}
// 选择站点语言时同步切换本页界面语言（与访客语言切换共用 cookie），已显示的错误按旧语言生成，一并清除
watch(siteLocale, (code) => {
  error.value = ''
  fieldError.value = null
  void switchLocale(code)
})
// 修改出错字段后清除它的提示，避免旧错误停留在已更正的输入框下
watch([token, username, password, confirmation], () => {
  fieldError.value = null
})

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

// 表单出现后聚焦第一个待填字段：令牌已带入时直接从登录名开始
watch(phase, (value) => {
  if (value === 'open') void focusField(showToken.value ? 'token' : 'username')
})

function validate(): { field: SetupField; message: string } | null {
  if (!token.value) return { field: 'token', message: t('admin-system.setup.tokenMissing') }
  if (!username.value) return { field: 'username', message: t('admin-system.setup.usernameHelp') }
  if (password.value.length < SETUP_PASSWORD_MIN_LENGTH)
    return { field: 'password', message: t('admin-system.setup.tooShort', { min: SETUP_PASSWORD_MIN_LENGTH }) }
  if (password.value.length > SETUP_PASSWORD_MAX_LENGTH)
    return { field: 'password', message: t('admin-system.setup.tooLong', { max: SETUP_PASSWORD_MAX_LENGTH }) }
  if (password.value !== confirmation.value) return { field: 'confirm', message: t('admin-system.setup.mismatch') }
  return null
}

/** 接口拒绝令牌（403）：展开令牌输入框并在框下提示，焦点移过去 */
async function rejectToken(message: string) {
  tokenRejected.value = true
  await nextTick()
  fieldError.value = { field: 'token', message }
  await focusField('token')
  // 选中旧令牌，粘贴即可整体替换
  inputs.token?.select()
}

async function submit() {
  if (submitting.value) return
  error.value = ''
  const problem = validate()
  if (problem) {
    if (problem.field === 'token') tokenRejected.value = true
    await nextTick()
    fieldError.value = problem
    await focusField(problem.field)
    return
  }
  if (previewPhase.value) {
    // 预览只检验前端校验与提示样式；&preview-submit=fail 模拟接口拒绝令牌时的展示
    if (route.query['preview-submit'] === 'fail') await rejectToken(t('admin-system.setup.previewFailed'))
    else success(t('admin-system.setup.previewSubmitted'))
    return
  }
  submitting.value = true
  const body: SetupRequest = {
    token: token.value,
    username: username.value,
    password: password.value,
    locale: siteLocale.value,
    ...(siteName.value ? { siteName: siteName.value } : {}),
  }
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
  token.value = password.value = confirmation.value = ''
  // 向导可能改写了站点名称；浏览器里已有的站点资料是创建前读取的，先重读，后台与页面标题才显示新名称。
  await Promise.resolve(siteSettings.refresh()).catch(() => {})
  // 账号已创建：用刚提交的凭据走常规登录直接进入后台；登录失败（如限流或网络中断）时退回登录页，账号不受影响。
  try {
    await login(body.username, body.password)
    success(t('admin-system.setup.successSignedIn'))
    await navigateTo('/admin')
  } catch {
    success(t('admin-system.setup.success'))
    await navigateTo({ path: '/admin/login', query: { setup: 'done' } })
  } finally {
    submitting.value = false
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
    void check()
  })
}
onBeforeUnmount(() => {
  token.value = password.value = confirmation.value = ''
})
</script>
<style scoped lang="scss">
// 安全居中：内容区高度放得下时上下居中，放不下时从顶部开始自然滚动，不会被裁切。
// 布局在 /setup 上不占顶栏高度，内容区即整屏，减去 admin-content 上下各 1.5rem 内边距。
.setup-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100dvh - 3rem);
}
.setup {
  width: 100%;
  max-width: 460px;
  min-width: 0;
  margin-block: auto;
  padding: 1.75rem 2rem;
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  background: var(--surface-1);
  box-shadow: var(--shadow-card);
  overflow-wrap: anywhere;
}
.setup__head {
  margin-bottom: 1.25rem;
}
.setup__mark {
  display: block;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 0.875rem;
  border-radius: $radius-md;
}
.setup h1 {
  margin: 0 0 0.375rem;
  font-size: 1.375rem;
  font-weight: 700;
}
.setup__intro,
.setup-field__help {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.55;
}
.setup__spin {
  animation: setup-spin 0.9s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
@keyframes setup-spin {
  to {
    transform: rotate(360deg);
  }
}
.setup__notice {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: stretch;
}
.setup__notice p {
  margin: 0;
}
.setup__action,
.setup__submit {
  gap: 0.5rem;
  min-height: 2.75rem;
}
.setup__form > fieldset {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.setup-field__error {
  display: flex;
  gap: 0.375rem;
  align-items: flex-start;
  margin: 0;
  color: var(--danger-text);
  font-size: 0.8125rem;
}
.setup-field__error svg {
  flex-shrink: 0;
  margin-top: 0.1875rem;
}
.setup-input[aria-invalid='true'] {
  border-color: var(--danger);
  &:focus {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger) 18%, transparent);
  }
}
.setup-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.setup-skeleton__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.setup-skeleton__label,
.setup-skeleton__input,
.setup-skeleton__button {
  display: block;
  border-radius: $radius-sm;
  background: var(--surface-3);
  animation: setup-pulse 1.4s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
.setup-skeleton__label {
  width: 5rem;
  height: 0.875rem;
}
.setup-skeleton__input,
.setup-skeleton__button {
  height: 2.75rem;
  border-radius: $radius-md;
}
.setup-skeleton__button {
  margin-top: 0.5rem;
}
@keyframes setup-pulse {
  50% {
    opacity: 0.5;
  }
}
.setup-group {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin: 0;
  padding: 1.25rem 0 0;
  border: 0;
  border-top: 1px solid var(--border-soft);
  min-width: 0;
}
.setup-group:first-child {
  padding-top: 0;
  border-top: 0;
}
.setup-group__title {
  float: left;
  width: 100%;
  margin: 0;
  padding: 0;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.setup-group__title + * {
  clear: both;
}
.setup-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.setup-field > label,
.setup-locale legend {
  font-size: 0.875rem;
  font-weight: 500;
}
// 向导内统一矩形圆角与 44px 触控高度，和按钮保持一致
.setup-input {
  min-height: 2.75rem;
  border-color: var(--border);
  border-radius: $radius-md;
  padding: 0.5rem 0.875rem;
}
.setup-password {
  position: relative;
}
.setup-password .setup-input {
  padding-right: 2.75rem;
}
.setup-password__toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: $radius-md;
  background: none;
  color: var(--text-soft);
  cursor: pointer;
  &:hover {
    color: var(--text-main);
  }
}
.setup-rules ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1rem;
  margin: 0 0 0.5rem;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  color: var(--text-soft);
}
.setup-rules li {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}
.setup-rules__met {
  color: var(--success-text);
}
.setup-locale {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.setup-locale legend {
  margin-bottom: 0.375rem;
  padding: 0;
}
// 分段选择：原生单选框铺满整段并透明，点击与键盘操作仍由它承担
.setup-locale__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
}
.setup-locale__option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  border-radius: $radius-sm;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
}
.setup-locale__option input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.setup-locale__option:has(input:checked) {
  background: var(--surface-1);
  color: var(--text-main);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.setup-locale__option:has(input:focus-visible) {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
.setup__error {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger-text);
  font-size: 0.8125rem;
}
.setup__error .iconify,
.setup__error svg {
  flex-shrink: 0;
  margin-top: 0.125rem;
}
.setup__submit {
  width: 100%;
}
@media (max-width: 760px) {
  // 窄屏 admin-content 内边距为 1rem，并给右上角浮动的主题按钮留出位置
  .setup-page {
    min-height: calc(100dvh - 2rem);
    padding-top: 3rem;
  }
}
@media (max-width: 520px) {
  .setup {
    padding: 1.5rem 1.25rem;
  }
}
</style>
