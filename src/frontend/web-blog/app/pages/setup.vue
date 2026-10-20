<!--
  @file setup.vue
  @description 浏览器初始化向导：凭安装时生成的一次性令牌创建首个博主账号；地址中的令牌读取后立即移除，
               页面不进入 SSR 缓存、不被索引、不发送 Referer，账号创建后后端永久关闭该入口
-->
<template>
  <section class="setup" aria-labelledby="setup-title">
    <h1 id="setup-title">{{ t('admin-system.setup.title') }}</h1>
    <p class="setup__intro">{{ t('admin-system.setup.intro') }}</p>
    <p v-if="previewPhase" class="setup__preview" role="note">{{ t('admin-system.setup.previewBanner') }}</p>
    <p v-if="phase === 'checking'" role="status">{{ t('admin-system.setup.checking') }}</p>
    <div v-else-if="phase === 'closed'" class="setup__notice" role="status">
      <p>{{ t('admin-system.setup.unavailable') }}</p>
      <NuxtLink to="/admin/login">{{ t('admin-system.setup.toLogin') }}</NuxtLink>
    </div>
    <div v-else-if="phase === 'error'" class="setup__notice" role="alert">
      <p>{{ t('admin-system.setup.statusFailed') }}</p>
      <button type="button" @click="check">{{ t('admin-system.setup.retry') }}</button>
    </div>
    <form v-else class="setup__form" novalidate @submit.prevent="submit">
      <fieldset :disabled="submitting">
        <div class="setup-field">
          <label for="setup-token">{{ t('admin-system.setup.tokenLabel') }}</label>
          <input
            id="setup-token"
            v-model.trim="token"
            class="input-field"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="512"
            required
            aria-describedby="setup-token-help"
          />
          <p id="setup-token-help" class="setup-field__help">
            {{ tokenFromLink ? t('admin-system.setup.tokenFromLink') : t('admin-system.setup.tokenHelp') }}
          </p>
        </div>
        <div class="setup-field">
          <label for="setup-username">{{ t('admin-system.setup.usernameLabel') }}</label>
          <input
            id="setup-username"
            v-model.trim="username"
            class="input-field"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            maxlength="64"
            required
            aria-describedby="setup-username-help"
          />
          <p id="setup-username-help" class="setup-field__help">{{ t('admin-system.setup.usernameHelp') }}</p>
        </div>
        <div class="setup-field">
          <label for="setup-password">{{ t('admin-system.setup.passwordLabel') }}</label>
          <input
            id="setup-password"
            v-model="password"
            class="input-field"
            type="password"
            autocomplete="new-password"
            :minlength="SETUP_PASSWORD_MIN_LENGTH"
            :maxlength="SETUP_PASSWORD_MAX_LENGTH"
            required
            aria-describedby="setup-password-rules setup-password-tip"
          />
        </div>
        <div class="setup-field">
          <label for="setup-confirm">{{ t('admin-system.setup.confirmLabel') }}</label>
          <input
            id="setup-confirm"
            v-model="confirmation"
            class="input-field"
            type="password"
            autocomplete="new-password"
            :maxlength="SETUP_PASSWORD_MAX_LENGTH"
            required
            aria-describedby="setup-password-rules"
          />
        </div>
        <div class="setup-rules">
          <p id="setup-password-rules-title" class="setup-rules__title">{{ t('admin-system.setup.passwordRules') }}</p>
          <ul id="setup-password-rules" aria-labelledby="setup-password-rules-title">
            <li v-for="rule in rules" :key="rule.key" :class="{ 'setup-rules__met': rule.met }">
              <Icon :name="rule.met ? 'lucide:circle-check' : 'lucide:circle'" aria-hidden="true" />
              <span>{{ rule.label }}</span>
              <span class="sr-only">{{
                rule.met ? t('admin-system.setup.ruleMet') : t('admin-system.setup.ruleUnmet')
              }}</span>
            </li>
          </ul>
          <p id="setup-password-tip" class="setup-field__help">{{ t('admin-system.setup.passwordTip') }}</p>
        </div>
        <div class="setup-field">
          <label for="setup-site-name">{{ t('admin-system.setup.siteNameLabel') }}</label>
          <input
            id="setup-site-name"
            v-model.trim="siteName"
            class="input-field"
            maxlength="80"
            aria-describedby="setup-site-name-help"
          />
          <p id="setup-site-name-help" class="setup-field__help">{{ t('admin-system.setup.siteNameHelp') }}</p>
        </div>
        <fieldset class="setup-locale" aria-describedby="setup-locale-help">
          <legend>{{ t('admin-system.setup.localeLabel') }}</legend>
          <label
            ><input v-model="siteLocale" type="radio" name="setup-locale" value="zh-CN" />{{
              t('admin-system.setup.localeZh')
            }}</label
          >
          <label
            ><input v-model="siteLocale" type="radio" name="setup-locale" value="en" />{{
              t('admin-system.setup.localeEn')
            }}</label
          >
          <p id="setup-locale-help" class="setup-field__help">{{ t('admin-system.setup.localeHelp') }}</p>
        </fieldset>
        <p v-if="error" id="setup-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn-primary" :aria-busy="submitting">
          {{ submitting ? t('admin-system.setup.submitting') : t('admin-system.setup.submit') }}
        </button>
      </fieldset>
    </form>
  </section>
</template>
<script setup lang="ts">
import type { SupportedLocale } from '~~/i18n/localeOptions'
import type { SetupPhase, SetupRequest } from '~/features/setup/types'
import { SETUP_PASSWORD_MAX_LENGTH, SETUP_PASSWORD_MIN_LENGTH, setupPasswordChecks } from '~/features/setup/password'

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

const phase = ref<SetupPhase>('checking')
const token = ref('')
const tokenFromLink = ref(false)
const username = ref('')
const password = ref('')
const confirmation = ref('')
const siteName = ref('')
const siteLocale = ref<SupportedLocale>(locale.value === 'en' ? 'en' : 'zh-CN')
const submitting = ref(false)
const error = ref('')

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
    if (!token.value) token.value = 'a'.repeat(48)
    return
  }
  phase.value = 'checking'
  try {
    phase.value = (await fetchSetupStatus()) ? 'open' : 'closed'
  } catch {
    phase.value = 'error'
  }
}

function validate(): string {
  if (!token.value) return t('admin-system.setup.tokenMissing')
  if (!username.value) return t('admin-system.setup.usernameHelp')
  if (password.value.length < SETUP_PASSWORD_MIN_LENGTH)
    return t('admin-system.setup.tooShort', { min: SETUP_PASSWORD_MIN_LENGTH })
  if (password.value.length > SETUP_PASSWORD_MAX_LENGTH)
    return t('admin-system.setup.tooLong', { max: SETUP_PASSWORD_MAX_LENGTH })
  if (password.value !== confirmation.value) return t('admin-system.setup.mismatch')
  return ''
}

async function submit() {
  if (submitting.value) return
  error.value = validate()
  if (error.value) return
  if (previewPhase.value) {
    // 预览只检验前端校验与提示样式；&preview-submit=fail 模拟接口拒绝时的错误展示
    if (route.query['preview-submit'] === 'fail') error.value = t('admin-system.setup.previewFailed')
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
    // 404 表示站点已完成初始化（含并发提交中另一方先成功），不再显示表单。
    if ((cause as { statusCode?: number } | null)?.statusCode === 404) phase.value = 'closed'
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
    void check()
  })
}
onBeforeUnmount(() => {
  token.value = password.value = confirmation.value = ''
})
</script>
<style scoped lang="scss">
.setup {
  max-width: 480px;
  min-width: 0;
  margin: 3rem auto;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  overflow-wrap: anywhere;
}
.setup h1 {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
}
.setup__intro,
.setup-field__help {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
.setup__preview {
  margin: 0 0 1.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--border);
  border-radius: 0.5rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
.setup__intro {
  margin-bottom: 1.25rem;
}
.setup__notice {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}
.setup__form > fieldset {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.setup-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.setup-rules ul {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.25rem 0 0.5rem;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
.setup-rules li {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}
.setup-rules__title {
  margin: 0;
  font-size: 0.875rem;
}
.setup-rules__met {
  color: var(--text-main);
}
.setup-locale {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.setup-locale legend {
  margin-bottom: 0.375rem;
  padding: 0;
}
.setup-locale label {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}
.setup-locale .setup-field__help {
  flex-basis: 100%;
}
</style>
