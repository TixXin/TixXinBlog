<!--
  @file LocaleSwitch.vue
  @description 界面语言切换：选项以各自语言书写，选择写入 blog-locale cookie 后就地切换，不整页重载
  @author TixXin
  @since 2026-10-19
-->

<template>
  <div class="locale-switch">
    <div class="locale-switch__options" role="group" :aria-label="t('common.locale.groupLabel')">
      <button
        v-for="option in options"
        :key="option.code"
        type="button"
        class="locale-switch__option"
        :class="{ 'locale-switch__option--active': locale === option.code }"
        :lang="option.code"
        :aria-pressed="locale === option.code"
        :disabled="switching"
        :data-locale="option.code"
        @click="onSelect(option.code)"
      >
        <Icon v-if="locale === option.code" name="lucide:check" size="14" aria-hidden="true" />
        <span>{{ option.name }}</span>
      </button>
    </div>
    <p class="locale-switch__status" role="status" aria-live="polite">
      <template v-if="switching">{{ t('common.locale.switching') }}</template>
      <template v-else-if="failed">{{ t('common.locale.switchFailed') }}</template>
    </p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { locale, options, switching, switchLocale } = useLocaleSwitch()
const failed = ref(false)

async function onSelect(code: string) {
  failed.value = false
  try {
    await switchLocale(code)
  } catch {
    failed.value = true
  }
}
</script>

<style lang="scss" scoped>
.locale-switch__options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.locale-switch__option {
  min-width: 0;
  min-height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.25rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    border-color: var(--border-hover);
    color: var(--text-main);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: progress;
  }
}

.locale-switch__option--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-main);
  box-shadow: inset 0 0 0 1px var(--accent-soft-active, rgba(91, 124, 250, 0.16));
}

.locale-switch__status {
  min-height: 0;
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  color: var(--text-soft);

  &:empty {
    display: none;
  }
}
</style>
