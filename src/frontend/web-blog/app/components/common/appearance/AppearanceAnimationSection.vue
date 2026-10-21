<!--
  @file AppearanceAnimationSection.vue
  @description 外观抽屉中的页面内容转场与侧栏展开动效预设选项
-->
<template>
  <div>
    <section v-if="isCapabilitySupported('contentTransition')" class="appearance-section">
      <div class="appearance-section__head">
        <h3 class="appearance-section__title">{{ t('layout.appearance.contentTransitionTitle') }}</h3>
        <span class="appearance-section__value">{{ contentTransitionLabel }}</span>
      </div>
      <div class="appearance-option-grid appearance-option-grid--anim">
        <button
          v-for="option in contentTransitionOptions"
          :key="option.value"
          type="button"
          class="appearance-option"
          :class="{ 'appearance-option--active': contentTransitionPreset === option.value }"
          :aria-pressed="contentTransitionPreset === option.value"
          @click="emit('updateContentTransition', option.value)"
        >
          <Icon :name="option.icon || 'lucide:sparkles'" size="18" />
          <span class="appearance-option__label">{{ option.label }}</span>
        </button>
      </div>
    </section>

    <section v-if="isCapabilitySupported('sidebarAnimation')" class="appearance-section">
      <div class="appearance-section__head">
        <h3 class="appearance-section__title">{{ t('layout.appearance.sidebarAnimationTitle') }}</h3>
        <span class="appearance-section__value">{{ sidebarAnimationLabel }}</span>
      </div>
      <div class="appearance-option-grid appearance-option-grid--anim">
        <button
          v-for="option in sidebarAnimationOptions"
          :key="option.value"
          type="button"
          class="appearance-option"
          :class="{ 'appearance-option--active': sidebarAnimationPreset === option.value }"
          :aria-pressed="sidebarAnimationPreset === option.value"
          @click="emit('updateSidebarAnimation', option.value)"
        >
          <Icon :name="option.icon || 'lucide:panel-left-open'" size="18" />
          <span class="appearance-option__label">{{ option.label }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ThemeCustomizerCapability } from '~/features/appearance/themeRegistry'
import type { AppearanceOption, ContentTransitionPreset, SidebarAnimationPreset } from '~/features/appearance/types'

defineProps<{
  isCapabilitySupported: (cap: ThemeCustomizerCapability) => boolean
  contentTransitionLabel: string
  contentTransitionPreset: ContentTransitionPreset
  contentTransitionOptions: readonly AppearanceOption<ContentTransitionPreset>[]
  sidebarAnimationLabel: string
  sidebarAnimationPreset: SidebarAnimationPreset
  sidebarAnimationOptions: readonly AppearanceOption<SidebarAnimationPreset>[]
}>()

const emit = defineEmits<{
  (e: 'updateContentTransition', value: ContentTransitionPreset): void
  (e: 'updateSidebarAnimation', value: SidebarAnimationPreset): void
}>()

const { t } = useI18n()
</script>

<style lang="scss" scoped>
.appearance-section {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);

  & + .appearance-section {
    margin-top: 0.5rem;
  }
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

.appearance-option-grid--anim {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;

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
