<!--
  @file SetupProfileStep.vue
  @description 初始化向导第二步「博主资料」：左列博主资料（头像、博主名与头衔、联系邮箱、社交链接），
               右列站点设置（名称、简介、建站日期、搜索引擎收录）；通过 v-model 编辑草稿，校验与提交由页面负责
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

      <div class="profile-step__pair">
        <div class="setup-field">
          <label for="setup-owner-name">{{ t('admin-system.setup.profile.ownerNameLabel') }}</label>
          <input
            id="setup-owner-name"
            v-model="draft.ownerName"
            class="input-field setup-input"
            maxlength="80"
            :placeholder="username"
            aria-describedby="setup-owner-name-help"
          />
          <p id="setup-owner-name-help" class="setup-field__help">
            {{ t('admin-system.setup.profile.ownerNameHelp') }}
          </p>
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
        <label for="setup-email">{{ t('admin-system.setup.profile.emailLabel') }}</label>
        <input
          id="setup-email"
          v-model="draft.email"
          class="input-field setup-input"
          type="email"
          inputmode="email"
          autocomplete="email"
          maxlength="254"
          placeholder="name@example.com"
          :aria-invalid="invalid('email')"
          :aria-describedby="errorFor('email') ? 'setup-email-error setup-email-help' : 'setup-email-help'"
        />
        <p v-if="errorFor('email')" id="setup-email-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError!.message }}</span>
        </p>
        <p id="setup-email-help" class="setup-field__help">{{ t('admin-system.setup.profile.emailHelp') }}</p>
      </div>

      <fieldset class="profile-step__socials">
        <legend>{{ t('admin-system.setup.profile.socialsLabel') }}</legend>
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
            <button
              type="button"
              class="profile-step__remove"
              :aria-label="t('admin-system.setup.profile.socialRemove', { name: socialLabel(link.icon, labelLocale) })"
              @click="draft.socials.splice(index, 1)"
            >
              <Icon name="lucide:x" aria-hidden="true" />
            </button>
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
        <!-- 每个平台只能添加一次：点平台即新增一行并聚焦，已添加的平台不再出现 -->
        <div v-if="available.length" class="profile-step__platforms">
          <button
            v-for="icon in available"
            :key="icon"
            type="button"
            class="profile-step__platform"
            :aria-label="t('admin-system.setup.profile.socialAdd', { name: socialLabel(icon, labelLocale) })"
            @click="addSocial(icon)"
          >
            <Icon name="lucide:plus" class="profile-step__plus" aria-hidden="true" /><Icon
              :name="icon"
              aria-hidden="true"
            /><span>{{ socialLabel(icon, labelLocale) }}</span>
          </button>
        </div>
      </fieldset>
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
          rows="3"
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
import { SOCIAL_PLACEHOLDERS, socialLabel } from '~/features/setup/profile'
import type { SetupProfileField } from '~/features/setup/profile'
import { SETUP_SOCIAL_ICONS, SETUP_SOCIAL_LIMIT } from '~/features/setup/types'
import type { SetupProfileDraft, SetupSocialIcon } from '~/features/setup/types'

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

/** 尚未添加的平台；达到上限后不再提供 */
const available = computed(() => {
  if (draft.value.socials.length >= SETUP_SOCIAL_LIMIT) return []
  const used = new Set(draft.value.socials.map((link) => link.icon))
  return SETUP_SOCIAL_ICONS.filter((icon) => !used.has(icon))
})

async function addSocial(icon: SetupSocialIcon) {
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
// 卡片展开到足够宽时左右两列：左侧博主资料（随社交链接增长），右侧站点设置（高度固定）
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
// 博主名与头衔并排，节省纵向空间；容器较窄时上下排列
.profile-step__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 1rem;
  align-items: start;
}
.profile-step__textarea {
  min-height: 5.25rem;
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
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.profile-step__social-row {
  position: relative;
  display: flex;
  gap: 0.25rem;
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
.profile-step__remove {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 0;
  border-radius: $radius-md;
  background: none;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--hover);
    color: var(--text-main);
  }
}
.profile-step__platforms {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.profile-step__platform {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 0.75rem 0 0.5rem;
  border: 1px dashed var(--border);
  border-radius: $radius-full;
  background: none;
  color: var(--text-muted);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    border-style: solid;
    border-color: var(--border-hover);
    color: var(--text-main);
  }
}
.profile-step__plus {
  font-size: 0.75rem;
  opacity: 0.7;
}
// 开关：原生复选框套 role="switch"，保留键盘与读屏操作
.profile-step__switch {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
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
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
