<!--
  @file SetupProfileStep.vue
  @description 初始化向导第二步「博主资料」：上方左右两列为博主资料（头像、博主名与头衔、联系邮箱）与站点设置
               （名称、简介、建站日期、搜索引擎收录），下方整行为固定列出全部平台的社交链接；
               高度不随填写变化。通过 v-model 编辑草稿，校验与提交由页面负责
-->
<template>
  <div class="profile-step">
    <fieldset class="setup-group profile-step__owner">
      <legend class="setup-group__title">{{ t('admin-system.setup.profile.sectionOwner') }}</legend>
      <SetupAvatarPicker
        :mode="draft.avatarMode"
        :letter="letterAvatar"
        :upload="draft.avatarUpload"
        :url="draft.avatarUrl"
        :email="draft.email"
        :name="draft.ownerName.trim() || username"
        :invalid="invalid('avatar') || invalid('avatarUrl')"
        :error-id="errorFor('avatar') || errorFor('avatarUrl') ? 'setup-avatar-error' : undefined"
        @update:mode="draft.avatarMode = $event"
        @update:upload="draft.avatarUpload = $event"
        @update:url="draft.avatarUrl = $event"
        @failed="emit('avatarFailed')"
      >
        <template #error>
          <p
            v-if="errorFor('avatar') || errorFor('avatarUrl')"
            id="setup-avatar-error"
            class="setup-field__error"
            role="alert"
          >
            <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
          </p>
        </template>
      </SetupAvatarPicker>

      <div class="profile-step__pair">
        <div class="setup-field">
          <label for="setup-owner-name">{{ t('admin-system.setup.profile.ownerNameLabel') }}</label>
          <!-- 占位即登录名：留空时使用登录名 -->
          <input
            id="setup-owner-name"
            v-model="draft.ownerName"
            class="input-field setup-input"
            maxlength="80"
            :placeholder="username"
          />
        </div>
        <div class="setup-field">
          <label for="setup-owner-title">{{ t('admin-system.setup.profile.ownerTitleLabel') }}</label>
          <input
            id="setup-owner-title"
            v-model="draft.ownerTitle"
            class="input-field setup-input"
            maxlength="200"
            :placeholder="t('admin-system.setup.profile.ownerTitlePlaceholder')"
          />
        </div>
      </div>

      <div class="setup-field">
        <!-- 选择邮箱头像时联系邮箱为必填 -->
        <label for="setup-email">{{
          emailRequired
            ? t('admin-system.setup.profile.emailLabelRequired')
            : t('admin-system.setup.profile.emailLabel')
        }}</label>
        <input
          id="setup-email"
          v-model="draft.email"
          class="input-field setup-input"
          type="email"
          inputmode="email"
          autocomplete="email"
          maxlength="254"
          placeholder="name@example.com"
          :required="emailRequired"
          :aria-required="emailRequired"
          :aria-invalid="invalid('email')"
          :aria-describedby="errorFor('email') ? 'setup-email-error setup-email-help' : 'setup-email-help'"
        />
        <p v-if="errorFor('email')" id="setup-email-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
        </p>
        <p id="setup-email-help" class="setup-field__help">{{ t('admin-system.setup.profile.emailHelp') }}</p>
      </div>
    </fieldset>

    <fieldset class="setup-group profile-step__site">
      <legend class="setup-group__title">{{ t('admin-system.setup.sectionSite') }}</legend>
      <div class="setup-field">
        <label for="setup-site-name">{{ t('admin-system.setup.siteNameLabel') }}</label>
        <!-- 占位即当前站点名：留空时沿用 -->
        <input
          id="setup-site-name"
          v-model="draft.siteName"
          class="input-field setup-input"
          maxlength="80"
          :placeholder="currentSiteName"
        />
      </div>
      <div class="setup-field">
        <label for="setup-description">{{ t('admin-system.setup.profile.descriptionLabel') }}</label>
        <textarea
          id="setup-description"
          v-model="draft.description"
          class="input-field setup-input profile-step__textarea"
          rows="3"
          maxlength="300"
          :placeholder="t('admin-system.setup.profile.descriptionPlaceholder')"
        />
      </div>
      <div class="setup-field">
        <label for="setup-launched-at">{{ t('admin-system.setup.profile.launchedAtLabel') }}</label>
        <!-- 自定义日期面板替代样式无法定制的原生日期弹窗；建站日期不晚于今天 -->
        <CommonDatePicker
          id="setup-launched-at"
          v-model="draft.launchedAt"
          :max="today"
          :invalid="invalid('launchedAt')"
          :describedby="errorFor('launchedAt') ? 'setup-launched-at-error' : undefined"
        />
        <p v-if="errorFor('launchedAt')" id="setup-launched-at-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
        </p>
      </div>
      <!-- 标题与开关同一行，说明在下方占满整行 -->
      <label class="profile-step__switch">
        <span class="profile-step__switch-title">{{ t('admin-system.setup.profile.indexingLabel') }}</span>
        <span id="setup-indexing-help" class="setup-field__help profile-step__switch-help">{{
          t('admin-system.setup.profile.indexingHelp')
        }}</span>
        <input
          id="setup-indexing"
          v-model="draft.searchIndexing"
          type="checkbox"
          role="switch"
          aria-describedby="setup-indexing-help"
        />
      </label>
    </fieldset>

    <fieldset class="setup-group profile-step__socials">
      <legend class="setup-group__title">{{ t('admin-system.setup.profile.socialsLabel') }}</legend>
      <!-- 全部平台固定列出，不增删行；留空的平台不提交 -->
      <div class="profile-step__social-grid">
        <div v-for="(link, index) in draft.socials" :key="link.icon" class="profile-step__social">
          <div class="profile-step__social-row">
            <span class="profile-step__social-icon" :title="socialLabel(link.icon, labelLocale)">
              <Icon :name="link.icon" aria-hidden="true" />
            </span>
            <input
              :id="`setup-social-${index}`"
              v-model="link.href"
              class="input-field setup-input"
              type="url"
              inputmode="url"
              maxlength="1000"
              :placeholder="SOCIAL_PLACEHOLDERS[link.icon]"
              :aria-label="t('admin-system.setup.profile.socialUrl', { name: socialLabel(link.icon, labelLocale) })"
              :aria-invalid="invalid(`social-${index}`)"
              :aria-describedby="errorFor(`social-${index}`) ? `setup-social-${index}-error` : undefined"
            />
          </div>
          <p
            v-if="errorFor(`social-${index}`)"
            :id="`setup-social-${index}-error`"
            class="setup-field__error"
            role="alert"
          >
            <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
          </p>
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { SupportedLocale } from '~~/i18n/localeOptions'
import { SOCIAL_PLACEHOLDERS, localDate, socialLabel } from '~/features/setup/profile'
import type { SetupProfileField } from '~/features/setup/profile'
import type { SetupProfileDraft } from '~/features/setup/types'

const draft = defineModel<SetupProfileDraft>({ required: true })
const props = defineProps<{
  username: string
  currentSiteName: string
  letterAvatar: string
  /** 社交链接显示名随所选站点语言写入 */
  labelLocale: SupportedLocale
  fieldError: { field: SetupProfileField; message: string } | null
}>()
const emit = defineEmits<{ avatarFailed: [] }>()
const { t } = useI18n()

const emailRequired = computed(() => draft.value.avatarMode === 'cravatar')
const today = localDate()

function errorFor(field: SetupProfileField) {
  return props.fieldError?.field === field
}
function invalid(field: SetupProfileField) {
  return errorFor(field) ? ('true' as const) : undefined
}
</script>

<style scoped lang="scss">
.profile-step {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
// 博主名与头衔并排；容器较窄时上下排列
.profile-step__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 1rem;
  align-items: start;
}
.profile-step__textarea {
  // 固定约 3 行且不可拖拽：卡片高度保持不变，并与左列底部对齐
  height: 5.125rem;
  resize: none;
}
.profile-step__social-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.625rem 1rem;
}
.profile-step__social {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}
.profile-step__social-row {
  position: relative;
  display: flex;
  align-items: center;

  // 多一个元素选择器，盖过页面下发的 .setup-input 内边距，给左侧平台图标留位
  input.setup-input {
    flex: 1;
    min-width: 0;
    padding-left: 2.5rem;
  }
}
// 平台图标嵌在输入框左侧
.profile-step__social-icon {
  position: absolute;
  left: 0.875rem;
  display: inline-flex;
  color: var(--text-muted);
  font-size: 1rem;
  pointer-events: none;
}
// 开关：原生复选框套 role="switch"，保留键盘与读屏操作
.profile-step__switch {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'title toggle'
    'help help';
  gap: 0.375rem 1rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  cursor: pointer;

  input {
    position: relative;
    grid-area: toggle;
    width: 2.5rem;
    height: 1.5rem;
    margin: 0;
    border-radius: $radius-full;
    background: var(--surface-3);
    appearance: none;
    cursor: pointer;
    transition: background 0.15s;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    &::after {
      position: absolute;
      top: 0.1875rem;
      left: 0.1875rem;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: $radius-full;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      content: '';
      transition: transform 0.15s;
      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
    }
    &:checked {
      background: var(--success-text);
    }
    &:checked::after {
      transform: translateX(1rem);
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
}
.profile-step__switch-title {
  grid-area: title;
  font-size: 0.875rem;
  font-weight: 500;
}
.profile-step__switch-help {
  grid-area: help;
}
// 卡片展开到足够宽时：上方博主资料与站点设置左右并列（两列高度相当），社交链接占整行
@container setup (min-width: 760px) {
  .profile-step {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'owner site'
      'socials socials';
    gap: 1.25rem 2.5rem;
    align-items: start;
  }
  .profile-step__owner {
    grid-area: owner;
  }
  .profile-step__site {
    grid-area: site;
  }
  .profile-step__socials {
    grid-area: socials;
  }
  // 比页面下发的 .setup :deep(.setup-group) 多一个元素选择器：并列的两组去掉分隔线
  .profile-step > fieldset.profile-step__owner,
  .profile-step > fieldset.profile-step__site {
    padding-top: 0;
    border-top: 0;
  }
  .profile-step__social-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
