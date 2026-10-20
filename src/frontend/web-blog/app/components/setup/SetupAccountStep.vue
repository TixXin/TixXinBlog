<!--
  @file SetupAccountStep.vue
  @description 初始化向导第一步：令牌（链接未带或被拒时才显示）、登录名与两次密码（含实时密码要求）、站点语言；
               通过 v-model 编辑，校验与提交由页面负责，focus / selectToken 供页面在出错时定位字段
-->
<template>
  <div class="account-step">
    <!-- 令牌随安装链接带入时不显示；链接未带或被接口拒绝时才要求手动填写 -->
    <div v-if="showToken" class="setup-field">
      <label for="setup-token">{{ t('admin-system.setup.tokenLabel') }}</label>
      <input
        id="setup-token"
        :ref="(el) => bind('token', el)"
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
          :ref="(el) => bind('username', el)"
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
        <p v-if="fieldError?.field === 'username'" id="setup-username-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
        </p>
        <p id="setup-username-help" class="setup-field__help">{{ t('admin-system.setup.usernameHelp') }}</p>
      </div>
      <div class="setup-field">
        <label for="setup-password">{{ t('admin-system.setup.passwordLabel') }}</label>
        <div class="account-step__password">
          <input
            id="setup-password"
            :ref="(el) => bind('password', el)"
            v-model="password"
            class="input-field setup-input"
            :type="visible ? 'text' : 'password'"
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
            :aria-label="visible ? t('admin-system.setup.hidePassword') : t('admin-system.setup.showPassword')"
            :aria-pressed="visible"
            aria-controls="setup-password setup-confirm"
            @click="visible = !visible"
          >
            <Icon :name="visible ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
          </button>
        </div>
        <p v-if="fieldError?.field === 'password'" id="setup-password-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
        </p>
      </div>
      <div class="setup-field">
        <label for="setup-confirm">{{ t('admin-system.setup.confirmLabel') }}</label>
        <input
          id="setup-confirm"
          :ref="(el) => bind('confirm', el)"
          v-model="confirmation"
          class="input-field setup-input"
          :type="visible ? 'text' : 'password'"
          autocomplete="new-password"
          :maxlength="SETUP_PASSWORD_MAX_LENGTH"
          required
          :aria-invalid="invalid('confirm')"
          :aria-describedby="describedBy('confirm', 'setup-password-rules')"
        />
        <p v-if="fieldError?.field === 'confirm'" id="setup-confirm-error" class="setup-field__error" role="alert">
          <Icon name="lucide:circle-alert" aria-hidden="true" /><span>{{ fieldError.message }}</span>
        </p>
      </div>
      <div class="account-step__rules">
        <p id="setup-password-rules-title" class="sr-only">{{ t('admin-system.setup.passwordRules') }}</p>
        <ul id="setup-password-rules" aria-labelledby="setup-password-rules-title">
          <li v-for="rule in rules" :key="rule.key" :class="{ 'is-met': rule.met }">
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
      <fieldset class="account-step__locale" aria-describedby="setup-locale-help">
        <legend>{{ t('admin-system.setup.localeLabel') }}</legend>
        <div class="account-step__locale-options">
          <label v-for="option in localeOptions" :key="option.value" class="account-step__locale-option"
            ><input v-model="locale" type="radio" name="setup-locale" :value="option.value" /><span>{{
              option.label
            }}</span></label
          >
        </div>
        <p id="setup-locale-help" class="setup-field__help">{{ t('admin-system.setup.localeHelp') }}</p>
      </fieldset>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { SupportedLocale } from '~~/i18n/localeOptions'
import { SETUP_PASSWORD_MAX_LENGTH, SETUP_PASSWORD_MIN_LENGTH, setupPasswordChecks } from '~/features/setup/password'
import type { SetupAccountField } from '~/features/setup/types'

const token = defineModel<string>('token', { required: true })
const username = defineModel<string>('username', { required: true })
const password = defineModel<string>('password', { required: true })
const confirmation = defineModel<string>('confirmation', { required: true })
const locale = defineModel<SupportedLocale>('locale', { required: true })
const props = defineProps<{
  showToken: boolean
  fieldError: { field: SetupAccountField; message: string } | null
}>()
const { t } = useI18n()
const visible = ref(false)
const inputs: Partial<Record<SetupAccountField, HTMLInputElement>> = {}

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

function bind(field: SetupAccountField, el: Element | ComponentPublicInstance | null) {
  inputs[field] = el instanceof HTMLInputElement ? el : undefined
}
function invalid(field: SetupAccountField) {
  return props.fieldError?.field === field ? 'true' : undefined
}
function describedBy(field: SetupAccountField, base: string) {
  return props.fieldError?.field === field ? `setup-${field}-error ${base}` : base
}

/** 聚焦字段；token 被拒时可同时全选，粘贴即可整体替换 */
async function focus(field: SetupAccountField, select = false) {
  await nextTick()
  inputs[field]?.focus()
  if (select) inputs[field]?.select()
}
defineExpose({ focus })
</script>

<style scoped lang="scss">
@use '~/assets/styles/setup-form' as form;
@include form.styles;

.account-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.account-step__password {
  position: relative;

  .setup-input {
    padding-right: 2.75rem;
  }
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
.account-step__rules ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1rem;
  margin: 0 0 0.5rem;
  padding: 0;
  list-style: none;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.account-step__rules li {
  display: flex;
  gap: 0.375rem;
  align-items: center;

  &.is-met {
    color: var(--success-text);
  }
}
.account-step__locale {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
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
// 分段选择：原生单选框铺满整段并透明，点击与键盘操作仍由它承担
.account-step__locale-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
}
.account-step__locale-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  border-radius: $radius-sm;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  &:has(input:checked) {
    background: var(--surface-1);
    color: var(--text-main);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  &:has(input:focus-visible) {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
}
</style>
