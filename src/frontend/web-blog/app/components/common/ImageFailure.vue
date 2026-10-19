<!--
  @file ImageFailure.vue
  @description 图片加载失败的共享占位与重试，支持键盘操作、读屏和紧凑图片
-->
<template>
  <span class="image-failure" :class="{ 'image-failure--compact': compact }">
    <button
      v-if="!compact"
      type="button"
      class="image-failure__retry image-failure__retry--full"
      :aria-label="buttonLabel"
      :aria-disabled="retrying || undefined"
      :aria-busy="retrying || undefined"
      @click.stop.prevent="retry"
      @keydown="stopActivation"
    >
      <Icon class="image-failure__icon" name="lucide:image-off" size="22" aria-hidden="true" />
      <span role="status">{{ $t('layout.image.failed') }}</span>
      <span class="image-failure__action">{{ retrying ? $t('layout.image.retrying') : $t('layout.image.retry') }}</span>
    </button>
    <CommonTooltip v-else :content="tooltipLabel">
      <button
        type="button"
        class="image-failure__retry image-failure__retry--compact"
        :aria-label="buttonLabel"
        :aria-disabled="retrying || undefined"
        :aria-busy="retrying || undefined"
        @click.stop.prevent="retry"
        @keydown="stopActivation"
      >
        <Icon name="lucide:image-off" size="18" aria-hidden="true" />
      </button>
    </CommonTooltip>
  </span>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{ alt: string; retrying?: boolean; compact?: boolean; retryLabel?: string }>(), {
  retrying: false,
  compact: false,
  retryLabel: undefined,
})
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const buttonLabel = computed(() => {
  const name = props.alt || t('layout.image.fallbackName')
  return props.retrying
    ? t('layout.image.reloading', { name })
    : props.retryLabel || t('layout.image.failedRetry', { name })
})
const tooltipLabel = computed(() =>
  props.retryLabel && !props.retrying ? t('layout.image.failedWith', { action: buttonLabel.value }) : buttonLabel.value,
)
function retry() {
  if (!props.retrying) emit('retry')
}
function stopActivation(event: KeyboardEvent) {
  // 保留原生按钮的 Enter/空格激活行为，并允许 Escape 继续关闭灯箱或提示。
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
}
</script>
<style lang="scss" scoped>
.image-failure {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  container-type: size;
  color: var(--text-soft);
  background: var(--surface-2);
  font-size: 0.8125rem;
  line-height: 1.4;
  text-align: center;
  white-space: normal;
}
.image-failure__retry {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: inherit;
  color: inherit;
  background: transparent;
  font: inherit;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }

  &--full {
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
  }

  &--compact {
    padding: 0;
  }
}
.image-failure__icon {
  flex: none;
}
.image-failure__action {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  color: var(--accent-text);
  background: var(--surface-1);
}

// 窄屏三列配图仍保留完整文字；整个占位都是按钮，不以叠加按钮高度挤出图片盒。
@container (max-height: 110px) {
  .image-failure__retry--full {
    gap: 0.125rem;
    padding: 0.125rem;
    font-size: 0.6875rem;
    line-height: 1.2;
  }
  .image-failure__icon {
    width: 18px;
    height: 18px;
  }
}

// 320px 视口下的三列配图仍展示完整反馈，避免文字换行后挤出重试入口。
@container (max-width: 70px) {
  .image-failure__retry--full {
    gap: 1px;
    padding: 0;
    font-size: 10px;
    line-height: 1.2;
  }
  .image-failure__icon {
    width: 14px;
    height: 14px;
  }
  .image-failure__action {
    padding: 0 2px;
  }
}
</style>
