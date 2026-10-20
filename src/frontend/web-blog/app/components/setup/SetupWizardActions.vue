<!--
  @file SetupWizardActions.vue
  @description 初始化向导底部操作栏：第一步「下一步」，第二步「上一步 / 跳过 / 创建博主账号」。
               吸附在视口底部，按钮组按步骤重新挂载并淡入；提交按钮为 type=submit，由外层表单处理。
               窄屏「上一步」只留图标、「跳过」用短文案（可访问名称保持完整），两步高度一致
-->
<template>
  <div class="wizard-actions">
    <div :key="step" class="wizard-actions__row">
      <button v-if="step === 1" type="submit" class="btn-primary wizard-actions__submit" :disabled="busy">
        {{ t('admin-system.setup.profile.next') }}<Icon name="lucide:arrow-right" aria-hidden="true" />
      </button>
      <template v-else>
        <button type="button" class="setup__back" :disabled="busy" @click="emit('back')">
          <Icon name="lucide:arrow-left" aria-hidden="true" /><span class="wizard-actions__back-text">{{
            t('admin-system.setup.profile.back')
          }}</span>
        </button>
        <button
          type="button"
          class="setup__skip"
          :disabled="busy"
          :aria-label="t('admin-system.setup.profile.skip')"
          @click="emit('skip')"
        >
          <span class="wizard-actions__skip-full" aria-hidden="true">{{ t('admin-system.setup.profile.skip') }}</span
          ><span class="wizard-actions__skip-short" aria-hidden="true">{{
            t('admin-system.setup.profile.skipShort')
          }}</span>
        </button>
        <button type="submit" class="btn-primary wizard-actions__submit" :disabled="busy" :aria-busy="submitting">
          <Icon v-if="submitting" name="lucide:loader-circle" class="wizard-actions__spin" aria-hidden="true" />
          {{ submitting ? t('admin-system.setup.submitting') : t('admin-system.setup.submit') }}
          <Icon v-if="!submitting" name="lucide:check" class="wizard-actions__check" aria-hidden="true" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ step: 1 | 2; busy: boolean; submitting: boolean }>()
const emit = defineEmits<{ back: []; skip: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
.wizard-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  flex-shrink: 0;
  // 向两侧延伸到卡片内边距，吸底时以卡片底色遮住下方滚动的内容
  margin: 0 -2rem -1.75rem;
  padding: 1rem 2rem 1.75rem;
  border-radius: 0 0 $radius-lg $radius-lg;
  background: linear-gradient(to bottom, transparent, var(--surface-1) 1rem);
}
.wizard-actions__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  animation: wizard-actions-in 0.24s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
@keyframes wizard-actions-in {
  from {
    opacity: 0;
  }
}
.wizard-actions__submit {
  flex: 1 1 10rem;
  gap: 0.5rem;
  min-height: 2.75rem;
}
.wizard-actions__spin {
  animation: wizard-actions-spin 0.9s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
@keyframes wizard-actions-spin {
  to {
    transform: rotate(360deg);
  }
}
.setup__back,
.setup__skip {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.375rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.875rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    border-color: var(--border-hover);
    color: var(--text-main);
  }
}
.setup__skip {
  padding: 0 0.5rem;
  border-color: transparent;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.wizard-actions__skip-short {
  display: none;
}
@media (max-width: 520px) {
  .wizard-actions {
    margin: 0 -1.25rem -1.5rem;
    padding: 1rem 1.25rem 1.5rem;
  }
  .setup__back {
    justify-content: center;
    width: 2.75rem;
    padding: 0;
  }
  .wizard-actions__back-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .wizard-actions__submit {
    flex-basis: auto;
    white-space: nowrap;
  }
  .wizard-actions__skip-full {
    display: none;
  }
  .wizard-actions__skip-short {
    display: inline;
  }
}
// 极窄屏（如 320px）省去主按钮末尾的对勾，三个按钮仍保持一行
@media (max-width: 360px) {
  .wizard-actions__check {
    display: none;
  }
}
</style>
