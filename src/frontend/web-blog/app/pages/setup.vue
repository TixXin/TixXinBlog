<!--
  @file setup.vue
  @description 浏览器初始化向导页：组装卡片外壳、两步表单与操作栏。流程与状态见 useSetupWizard，
               步骤切换动画见 useStepTransition。地址中的令牌读取后立即移除，页面不进入 SSR 缓存、不被索引、
               不发送 Referer，账号创建后后端永久关闭该入口
-->
<template>
  <div class="setup-page">
    <section
      ref="card"
      class="setup"
      :class="{ 'setup--wide': step === 2, 'is-switching': switching }"
      aria-labelledby="setup-title"
      :aria-busy="phase === 'checking'"
    >
      <header class="setup__head">
        <div class="setup__brand">
          <img class="setup__mark" src="/icon.svg" alt="" width="44" height="44" />
          <p v-if="phase === 'open'" class="setup__step">
            <span class="setup__dots" aria-hidden="true"
              ><span v-for="index in 2" :key="index" :class="{ 'is-active': index <= step }"
            /></span>
            {{ t('admin-system.setup.profile.stepOf', { step, total: 2 }) }}
          </p>
        </div>
        <div ref="headText">
          <h1 id="setup-title" ref="heading" tabindex="-1">
            {{ step === 1 ? t('admin-system.setup.welcome') : t('admin-system.setup.profile.title') }}
          </h1>
          <p class="setup__intro">
            {{ step === 1 ? t('admin-system.setup.intro') : t('admin-system.setup.profile.intro') }}
          </p>
        </div>
      </header>
      <SetupStatusPanel v-if="phase !== 'open'" :phase="phase" @retry="check" />
      <form v-else class="setup__form" novalidate @submit.prevent="onSubmit">
        <fieldset :disabled="busy">
          <!-- 步骤内容整体参与切换动画：先向切换方向淡出，卡片缩放到新尺寸后从另一侧滑入 -->
          <div ref="stage" class="setup__stage">
            <SetupAccountStep
              v-if="step === 1"
              ref="account"
              v-model:token="token"
              v-model:username="username"
              v-model:password="password"
              v-model:confirmation="confirmation"
              v-model:locale="siteLocale"
              :show-token="showToken"
              :field-error="fieldError"
            />
            <SetupProfileStep
              v-else
              v-model="profile"
              :username="username"
              :current-site-name="currentSiteName"
              :letter-avatar="letterAvatar"
              :label-locale="siteLocale"
              :field-error="profileError"
              @avatar-failed="profileFailed('avatar', 'avatarUnreadable')"
            />
            <p v-if="error" id="setup-error" class="setup__error" role="alert">
              <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ error }}</span>
            </p>
          </div>
        </fieldset>
        <!-- 操作栏在 fieldset 之外、固定在卡片底部：切换时随卡片底边平滑移动，不参与内容的淡出滑入 -->
        <SetupWizardActions :step="step" :busy="busy" :submitting="submitting" @back="back" @skip="skip" />
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { SetupProfileField } from '~/features/setup/profile'
import type { SetupAccountField } from '~/features/setup/types'
import { prefersReducedMotion, useStepTransition } from '~/features/setup/useStepTransition'
import { useSetupWizard } from '~/features/setup/useSetupWizard'

definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.setup.title'), robots: 'noindex, nofollow' })
// 令牌可能出现在首屏地址中：页面内的链接与资源请求都不携带来源地址。
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })

const step = ref<1 | 2>(1)
const card = ref<HTMLElement | null>(null)
const headText = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const account = ref<{ focus: (field: SetupAccountField, select?: boolean) => Promise<void> } | null>(null)
const { switching, switchStep } = useStepTransition(step, card, () =>
  [headText.value, stage.value].filter((part): part is HTMLElement => !!part),
)

/** 切换步骤后把焦点交给标题（读屏播报新步骤）；窄屏单列时若卡片顶部已滚出视口，回到顶部 */
async function goTo(target: 1 | 2) {
  await switchStep(target)
  heading.value?.focus({ preventScroll: true })
  if (card.value && card.value.getBoundingClientRect().top < 0)
    card.value.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
async function focusAccount(field: SetupAccountField, select = false) {
  await nextTick()
  await account.value?.focus(field, select)
}
/** 第二步错误定位：聚焦与该错误提示关联的控件 */
async function focusProfile(field: SetupProfileField) {
  await nextTick()
  const id = `setup-${field === 'avatarUrl' ? 'avatar' : field}-error`
  document.querySelector<HTMLElement>(`[aria-describedby~="${id}"]`)?.focus()
}

const {
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
  skip,
  profileFailed,
} = useSetupWizard({ step, switchStep, goTo, focusAccount, focusProfile })
/** 提交中或切换步骤动画中：表单与操作栏都不可操作 */
const busy = computed(() => submitting.value || switching.value)
</script>

<style scoped lang="scss">
// 安全居中：放得下时上下居中，放不下时从顶部开始自然滚动；/setup 不占顶栏高度，减去 admin-content 上下内边距
.setup-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100dvh - 3rem);
}
// 纵向弹性：切换步骤的尺寸动画中只有 fieldset 被压缩裁切，标题与操作栏保持原样
.setup {
  display: flex;
  flex-direction: column;
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
.setup--wide {
  max-width: 880px;
}
.setup__head {
  flex-shrink: 0;
  margin-bottom: 1rem;
}
// Logo 与步骤进度同行，压缩标题区高度
.setup__brand {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
.setup__mark {
  display: block;
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: $radius-md;
}
.setup__step {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
}
.setup__dots {
  display: inline-flex;
  gap: 0.25rem;

  span {
    width: 1.25rem;
    height: 0.25rem;
    border-radius: $radius-full;
    background: var(--surface-3);
  }
  .is-active {
    background: var(--accent);
  }
}
.setup h1 {
  margin: 0 0 0.375rem;
  font-size: 1.375rem;
  font-weight: 700;

  &:focus {
    outline: none;
  }
}
.setup__intro {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.55;
}
.setup__form {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 0;
}
// fieldset 只作为弹性子项收缩：Chrome 中 fieldset 作弹性容器时子项不会按 min-height: 0 收缩
.setup__form > fieldset {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
// 尺寸动画期间只裁切 fieldset（clip 不形成滚动容器，不影响操作栏的视口吸底）
.setup.is-switching .setup__form > fieldset {
  overflow: clip;
}
// 第二步按内容宽度切换为两列（见 SetupProfileStep 的容器查询）；切换动画期间该宽度被锁定为最终值
.setup__stage {
  container: setup / inline-size;
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

  svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }
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
