<!--
  @file AppearanceColorModeSection.vue
  @description 外观抽屉中的颜色模式（浅色/深色/跟随系统）与颜色切换动效选择
-->
<template>
  <div>
    <section class="appearance-section appearance-section--first">
      <div class="appearance-section__head">
        <h3 class="appearance-section__title">{{ t('layout.appearance.colorModeTitle') }}</h3>
        <span class="appearance-section__value">{{ themeLabel }}</span>
      </div>
      <div class="appearance-option-grid appearance-option-grid--theme">
        <button
          v-for="option in themeOptions"
          :key="option"
          type="button"
          class="appearance-option"
          :class="{ 'appearance-option--active': currentPreference === option }"
          :aria-pressed="currentPreference === option"
          @pointerdown="onColorThemePointerDown(option, $event)"
          @click="onColorThemeClick(option, $event)"
        >
          <Icon :name="themeIcons[option]" size="18" />
          <span class="appearance-option__label">{{ themeLabels[option] }}</span>
        </button>
      </div>
    </section>

    <section class="appearance-section">
      <div class="appearance-section__head">
        <h3 class="appearance-section__title">{{ t('layout.appearance.colorModeTransitionTitle') }}</h3>
        <span class="appearance-section__value">{{ colorModeTransitionLabel }}</span>
      </div>
      <div class="appearance-option-grid appearance-option-grid--anim">
        <button
          v-for="option in colorModeTransitionOptions"
          :key="option.value"
          type="button"
          class="appearance-option"
          :class="{ 'appearance-option--active': colorModeTransitionPreset === option.value }"
          :aria-pressed="colorModeTransitionPreset === option.value"
          :title="option.description"
          @click="emit('updateTransition', option.value)"
        >
          <Icon :name="option.icon || 'lucide:sparkles'" size="18" />
          <span class="appearance-option__label">{{ option.label }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  COLOR_MODE_LABELS,
  type AppearanceOption,
  type ColorModeTransitionPreset,
  type ThemeOption,
} from '~/features/appearance/types'

defineProps<{
  currentPreference: ThemeOption
  themeOptions: readonly ThemeOption[]
  themeLabel: string
  colorModeTransitionLabel: string
  colorModeTransitionPreset: ColorModeTransitionPreset
  colorModeTransitionOptions: readonly AppearanceOption<ColorModeTransitionPreset>[]
}>()

const emit = defineEmits<{
  (e: 'selectTheme', option: ThemeOption, event: MouseEvent | PointerEvent): void
  (e: 'updateTransition', value: ColorModeTransitionPreset): void
}>()

const { t } = useI18n()
const themeLabels = COLOR_MODE_LABELS
const themeIcons: Record<ThemeOption, string> = {
  light: 'lucide:sun',
  system: 'lucide:monitor',
  dark: 'lucide:moon',
}

function onColorThemePointerDown(option: ThemeOption, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  emit('selectTheme', option, e)
}

function onColorThemeClick(option: ThemeOption, e: MouseEvent) {
  emit('selectTheme', option, e)
}
</script>

<style lang="scss" scoped>
.appearance-section {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);

  & + .appearance-section {
    margin-top: 0.5rem;
  }
}

.appearance-section--first {
  padding-top: 0;
  border-top: none;
}

.appearance-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.appearance-section__title {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}

.appearance-section__value {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.appearance-option-grid {
  display: grid;
  gap: 0.5rem;
}

.appearance-option-grid--theme {
  grid-template-columns: repeat(3, 1fr);
}

.appearance-option-grid--anim {
  grid-template-columns: repeat(4, 1fr);

  @media (max-width: $breakpoint-xs) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.appearance-option {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.25rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-soft);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--border-hover);
    color: var(--text-main);
  }
}

.appearance-option--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-main);
  box-shadow: inset 0 0 0 1px var(--accent-soft-active, rgba(91, 124, 250, 0.16));
}

.appearance-option__label {
  font-size: 0.625rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
