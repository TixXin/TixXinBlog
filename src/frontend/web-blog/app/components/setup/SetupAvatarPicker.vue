<!--
  @file SetupAvatarPicker.vue
  @description 初始化向导的头像选择：字母头像、本地上传（居中裁成方形）、按联系邮箱取 Cravatar、填写 https 图片地址；
               各方式的操作区与说明占用固定高度，切换时不改变卡片尺寸。只负责展示与选择，提交由页面汇总
-->
<template>
  <fieldset class="avatar-picker" aria-describedby="setup-avatar-help">
    <legend>{{ t('admin-system.setup.profile.avatarLabel') }}</legend>
    <div class="avatar-picker__body">
      <span class="avatar-picker__preview" :class="{ 'is-empty': !preview }">
        <img v-if="preview" :src="preview" alt="" width="72" height="72" @error="previewFailed = true" />
        <Icon v-else name="lucide:user-round" aria-hidden="true" />
      </span>
      <div class="avatar-picker__controls">
        <div class="avatar-picker__modes" role="radiogroup" :aria-label="t('admin-system.setup.profile.avatarLabel')">
          <label v-for="option in modes" :key="option.value" class="avatar-picker__mode"
            ><input
              type="radio"
              name="setup-avatar-mode"
              :value="option.value"
              :checked="mode === option.value"
              @change="emit('update:mode', option.value)"
            /><Icon :name="option.icon" aria-hidden="true" /><span>{{ option.label }}</span></label
          >
        </div>
        <!-- 操作区固定一行高度：字母与邮箱头像显示状态，上传显示按钮，链接显示输入框 -->
        <div class="avatar-picker__detail">
          <p v-if="mode === 'letter'" class="avatar-picker__status">
            {{ t('admin-system.setup.profile.avatarLetterStatus', { name: name || '?' }) }}
          </p>
          <p v-else-if="mode === 'cravatar'" class="avatar-picker__status" :class="{ 'is-warning': !email.trim() }">
            <Icon v-if="!email.trim()" name="lucide:circle-alert" aria-hidden="true" />
            <span>{{
              email.trim()
                ? t('admin-system.setup.profile.avatarCravatarStatus', { email: email.trim() })
                : t('admin-system.setup.profile.avatarCravatarNeedsEmail')
            }}</span>
          </p>
          <template v-else-if="mode === 'upload'">
            <button
              type="button"
              class="avatar-picker__button"
              :aria-invalid="invalid"
              :aria-describedby="errorId"
              @click="file?.click()"
            >
              <Icon name="lucide:upload" aria-hidden="true" />{{
                upload ? t('admin-system.setup.profile.avatarReplace') : t('admin-system.setup.profile.avatarChoose')
              }}
            </button>
            <input
              ref="file"
              class="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              tabindex="-1"
              aria-hidden="true"
              @change="choose"
            />
          </template>
          <input
            v-else-if="mode === 'url'"
            id="setup-avatar-url"
            class="input-field setup-input"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            maxlength="1000"
            placeholder="https://"
            :value="url"
            :aria-label="t('admin-system.setup.profile.avatarUrlLabel')"
            :aria-invalid="invalid"
            :aria-describedby="errorId"
            @input="emit('update:url', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p id="setup-avatar-help" class="setup-field__help">{{ help }}</p>
      </div>
    </div>
    <slot name="error" />
  </fieldset>
</template>

<script setup lang="ts">
import { cravatarUrl, cropAvatarFile } from '~/features/setup/avatar'
import type { SetupAvatarMode } from '~/features/setup/types'

const props = defineProps<{
  mode: SetupAvatarMode
  /** 字母头像的 data URL，由页面按博主名绘制 */
  letter: string
  upload: string
  url: string
  email: string
  /** 字母头像取字的名称（博主名，留空时为登录名） */
  name: string
  invalid?: 'true'
  errorId?: string
}>()
const emit = defineEmits<{
  'update:mode': [value: SetupAvatarMode]
  'update:upload': [value: string]
  'update:url': [value: string]
  /** 图片无法读取或过大 */
  failed: []
}>()
const { t } = useI18n()
const file = ref<HTMLInputElement | null>(null)
const previewFailed = ref(false)

const modes = computed(() => [
  { value: 'letter' as const, icon: 'lucide:type', label: t('admin-system.setup.profile.avatarLetter') },
  { value: 'upload' as const, icon: 'lucide:image-up', label: t('admin-system.setup.profile.avatarUpload') },
  { value: 'cravatar' as const, icon: 'lucide:at-sign', label: t('admin-system.setup.profile.avatarCravatar') },
  { value: 'url' as const, icon: 'lucide:link', label: t('admin-system.setup.profile.avatarUrl') },
])

const preview = computed(() => {
  if (previewFailed.value) return ''
  if (props.mode === 'letter') return props.letter
  if (props.mode === 'upload') return props.upload
  if (props.mode === 'cravatar') return props.email.trim() ? cravatarUrl(props.email) : ''
  return /^https:\/\//.test(props.url.trim()) ? props.url.trim() : ''
})
// 切换来源或地址变化后重新尝试加载预览
watch(
  () => [props.mode, props.url, props.email, props.upload],
  () => {
    previewFailed.value = false
  },
)

const help = computed(() =>
  t(
    {
      letter: 'admin-system.setup.profile.avatarLetterHelp',
      upload: 'admin-system.setup.profile.avatarUploadHelp',
      cravatar: 'admin-system.setup.profile.avatarCravatarHelp',
      url: 'admin-system.setup.profile.avatarUrlHelp',
    }[props.mode],
  ),
)

async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  input.value = ''
  if (!chosen) return
  try {
    emit('update:upload', await cropAvatarFile(chosen))
  } catch {
    emit('failed')
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/setup-form' as form;
@include form.styles;

.avatar-picker {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.avatar-picker legend {
  margin-bottom: 0.5rem;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 500;
}
.avatar-picker__body {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.avatar-picker__preview {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 1.75rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.avatar-picker__controls {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}
// 与站点语言一致的分段选择：原生单选框铺满整段并透明
.avatar-picker__modes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
}
.avatar-picker__mode {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.25rem;
  border-radius: $radius-sm;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-align: center;
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
.avatar-picker__detail {
  display: flex;
  align-items: stretch;
  height: 2.75rem;

  > * {
    flex: 1;
    min-width: 0;
  }
}
// 状态说明与输入框同高，单行省略
.avatar-picker__status {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin: 0;
  padding: 0 0.875rem;
  overflow: hidden;
  border: 1px dashed var(--border);
  border-radius: $radius-md;
  color: var(--text-muted);
  font-size: 0.8125rem;
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &.is-warning {
    border-color: var(--danger);
    color: var(--danger-text);
  }
}
// 说明固定占两行，各方式文案长短不一也不改变高度
.avatar-picker__controls > .setup-field__help {
  min-height: calc(2 * 1.55em);
}
.avatar-picker__button {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px dashed var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    border-color: var(--border-hover);
  }
  &[aria-invalid='true'] {
    border-color: var(--danger);
  }
}
@media (max-width: 420px) {
  .avatar-picker__body {
    flex-direction: column;
  }
}
</style>
