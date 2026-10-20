<!--
  @file SetupProfileStep.vue
  @description 初始化向导第二步「博主资料」：头像、博主名与头衔、联系邮箱、站点名称与简介、建站日期、社交链接、
               搜索引擎收录；通过 v-model 编辑草稿，校验与提交由页面负责
-->
<template>
  <div class="profile-step">
    <fieldset class="setup-group">
      <legend class="setup-group__title">{{ t('admin-system.setup.profile.sectionOwner') }}</legend>
      <SetupAvatarPicker
        :mode="draft.avatarMode"
        :letter="letterAvatar"
        :upload="draft.avatarUpload"
        :url="draft.avatarUrl"
        :email="draft.email"
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

      <div class="setup-field">
        <span class="setup-field__label">{{ t('admin-system.setup.profile.ownerNameLabel') }}</span>
        <label class="profile-step__check">
          <input v-model="draft.ownerSameAsUsername" type="checkbox" />
          <span>{{ t('admin-system.setup.profile.ownerSame', { name: username }) }}</span>
        </label>
        <template v-if="!draft.ownerSameAsUsername">
          <input
            id="setup-owner-name"
            v-model="draft.ownerName"
            class="input-field setup-input"
            maxlength="80"
            :aria-label="t('admin-system.setup.profile.ownerNameLabel')"
            :aria-invalid="invalid('ownerName')"
            :aria-describedby="errorFor('ownerName') ? 'setup-owner-name-error' : undefined"
          />
          <p v-if="errorFor('ownerName')" id="setup-owner-name-error" class="setup-field__error" role="alert">
            <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
          </p>
        </template>
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
      <div class="setup-field">
        <label for="setup-email">{{ t('admin-system.setup.profile.emailLabel') }}</label>
        <input
          id="setup-email"
          v-model="draft.email"
          class="input-field setup-input"
          type="email"
          inputmode="email"
          autocomplete="email"
          maxlength="254"
          :aria-invalid="invalid('email')"
          :aria-describedby="errorFor('email') ? 'setup-email-error setup-email-help' : 'setup-email-help'"
        />
        <p v-if="errorFor('email')" id="setup-email-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
        </p>
        <p id="setup-email-help" class="setup-field__help">{{ t('admin-system.setup.profile.emailHelp') }}</p>
      </div>
    </fieldset>

    <fieldset class="setup-group">
      <legend class="setup-group__title">{{ t('admin-system.setup.sectionSite') }}</legend>
      <div class="setup-field">
        <label for="setup-site-name">{{ t('admin-system.setup.siteNameLabel') }}</label>
        <input
          id="setup-site-name"
          v-model="draft.siteName"
          class="input-field setup-input"
          maxlength="80"
          :placeholder="currentSiteName"
          aria-describedby="setup-site-name-help"
        />
        <p id="setup-site-name-help" class="setup-field__help">
          {{ t('admin-system.setup.siteNameHelp', { name: currentSiteName }) }}
        </p>
      </div>
      <div class="setup-field">
        <label for="setup-description">{{ t('admin-system.setup.profile.descriptionLabel') }}</label>
        <textarea
          id="setup-description"
          v-model="draft.description"
          class="input-field setup-input profile-step__textarea"
          rows="2"
          maxlength="300"
          :placeholder="t('admin-system.setup.profile.descriptionPlaceholder')"
        />
      </div>
      <div class="setup-field">
        <label for="setup-launched-at">{{ t('admin-system.setup.profile.launchedAtLabel') }}</label>
        <input
          id="setup-launched-at"
          v-model="draft.launchedAt"
          class="input-field setup-input"
          type="date"
          :aria-invalid="invalid('launchedAt')"
          :aria-describedby="
            errorFor('launchedAt') ? 'setup-launched-at-error setup-launched-at-help' : 'setup-launched-at-help'
          "
        />
        <p v-if="errorFor('launchedAt')" id="setup-launched-at-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
        </p>
        <p id="setup-launched-at-help" class="setup-field__help">
          {{ t('admin-system.setup.profile.launchedAtHelp') }}
        </p>
      </div>

      <fieldset class="profile-step__socials">
        <legend>{{ t('admin-system.setup.profile.socialsLabel') }}</legend>
        <div v-for="(link, index) in draft.socials" :key="index" class="profile-step__social">
          <select
            v-model="link.icon"
            class="input-field setup-input profile-step__select"
            :aria-label="t('admin-system.setup.profile.socialType', { index: index + 1 })"
          >
            <option v-for="icon in SETUP_SOCIAL_ICONS" :key="icon" :value="icon">
              {{ socialLabel(icon, labelLocale) }}
            </option>
          </select>
          <input
            :id="`setup-social-${index}`"
            v-model="link.href"
            class="input-field setup-input"
            type="url"
            inputmode="url"
            maxlength="1000"
            placeholder="https://"
            :aria-label="t('admin-system.setup.profile.socialUrl', { index: index + 1 })"
            :aria-invalid="invalid(`social-${index}`)"
            :aria-describedby="errorFor(`social-${index}`) ? `setup-social-${index}-error` : undefined"
          />
          <button
            type="button"
            class="profile-step__remove"
            :aria-label="t('admin-system.setup.profile.socialRemove', { index: index + 1 })"
            @click="draft.socials.splice(index, 1)"
          >
            <Icon name="lucide:x" aria-hidden="true" />
          </button>
          <p
            v-if="errorFor(`social-${index}`)"
            :id="`setup-social-${index}-error`"
            class="setup-field__error profile-step__social-error"
            role="alert"
          >
            <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
          </p>
        </div>
        <button
          type="button"
          class="profile-step__add"
          :disabled="draft.socials.length >= SETUP_SOCIAL_LIMIT"
          @click="addSocial"
        >
          <Icon name="lucide:plus" aria-hidden="true" />{{ t('admin-system.setup.profile.socialAdd') }}
        </button>
      </fieldset>

      <label class="profile-step__switch">
        <span class="profile-step__switch-text">
          <span>{{ t('admin-system.setup.profile.indexingLabel') }}</span>
          <span id="setup-indexing-help" class="setup-field__help">{{
            t('admin-system.setup.profile.indexingHelp')
          }}</span>
        </span>
        <input
          id="setup-indexing"
          v-model="draft.searchIndexing"
          type="checkbox"
          role="switch"
          aria-describedby="setup-indexing-help"
        />
      </label>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { SupportedLocale } from '~~/i18n/localeOptions'
import { socialLabel } from '~/features/setup/profile'
import type { SetupProfileField } from '~/features/setup/profile'
import { SETUP_SOCIAL_ICONS, SETUP_SOCIAL_LIMIT } from '~/features/setup/types'
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

function errorFor(field: SetupProfileField) {
  return props.fieldError?.field === field
}
function invalid(field: SetupProfileField) {
  return errorFor(field) ? ('true' as const) : undefined
}

/** 依次推荐尚未使用的平台，默认先 GitHub */
async function addSocial() {
  const used = new Set(draft.value.socials.map((link) => link.icon))
  const icon = SETUP_SOCIAL_ICONS.find((value) => !used.has(value)) ?? 'lucide:link'
  draft.value.socials.push({ icon, href: '' })
  await nextTick()
  document.getElementById(`setup-social-${draft.value.socials.length - 1}`)?.focus()
}
</script>

<style scoped lang="scss">
.profile-step {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
// 卡片展开到足够宽时左右两列：左侧博主资料，右侧站点设置，整体高度与第一步接近
@container setup (min-width: 760px) {
  .profile-step {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2.5rem;
    align-items: start;
  }
  // 比页面下发的 .setup :deep(.setup-group) 多一个元素选择器，确保两列时去掉分隔线
  .profile-step > fieldset.setup-group {
    padding-top: 0;
    border-top: 0;
  }
}
.setup-field__label {
  font-size: 0.875rem;
  font-weight: 500;
}
.profile-step__check {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;

  input {
    width: 1rem;
    height: 1rem;
    accent-color: var(--text-main);
  }
}
.profile-step__textarea {
  min-height: 4.5rem;
  resize: vertical;
}
.profile-step__socials {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;

  legend {
    margin-bottom: 0.375rem;
    padding: 0;
    font-size: 0.875rem;
    font-weight: 500;
  }
}
.profile-step__social {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr) 2.75rem;
  gap: 0.375rem;
  align-items: center;
}
.profile-step__social-error {
  grid-column: 1 / -1;
}
.profile-step__select {
  padding-right: 0.5rem;
}
.profile-step__remove,
.profile-step__add {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  border-radius: $radius-md;
  color: var(--text-muted);
  cursor: pointer;
}
.profile-step__remove {
  border: 0;
  background: none;

  &:hover {
    background: var(--hover);
    color: var(--text-main);
  }
}
.profile-step__add {
  align-self: flex-start;
  padding: 0 0.875rem;
  border: 1px dashed var(--border);
  background: none;
  font-size: 0.875rem;

  &:hover:not(:disabled) {
    border-color: var(--border-hover);
    color: var(--text-main);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
// 开关：原生复选框套 role="switch"，保留键盘与读屏操作
.profile-step__switch {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  cursor: pointer;

  input {
    position: relative;
    flex-shrink: 0;
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
.profile-step__switch-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.875rem;
  font-weight: 500;
}
@media (max-width: 420px) {
  .profile-step__social {
    grid-template-columns: minmax(0, 1fr) 2.75rem;
  }
  .profile-step__select {
    grid-column: 1 / -1;
  }
}
</style>
