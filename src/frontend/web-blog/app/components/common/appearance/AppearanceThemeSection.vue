<!-- @file AppearanceThemeSection.vue @description 外观抽屉中的布局主题（Nexus/Aurora/Dock）选择与引擎提示 -->
<template>
  <section class="appearance-section">
    <div class="appearance-section__head">
      <h3 class="appearance-section__title">
        {{ t('layout.appearance.layoutThemeTitle') }}
        <a
          ref="engineBadgeRef"
          href="https://github.com/TixXin/nuxt-theme-engine"
          target="_blank"
          rel="noopener noreferrer"
          class="appearance-engine-badge"
          @mouseenter="showEngineTip"
          @mouseleave="hideEngineTip"
        >
          <Icon name="lucide:info" size="13" />
        </a>
      </h3>
      <span class="appearance-section__value">
        {{ layoutThemeLabel }}
        <span v-if="switchingState === 'loading'" class="appearance-section__status">{{
          t('layout.appearance.switching')
        }}</span>
        <span
          v-else-if="switchingState === 'error'"
          class="appearance-section__status appearance-section__status--error"
          >{{ t('layout.appearance.switchFailed') }}</span
        >
      </span>
    </div>
    <div class="appearance-option-grid appearance-option-grid--theme">
      <button
        v-for="theme in availableThemes"
        :key="theme.id"
        type="button"
        class="appearance-option"
        :class="{
          'appearance-option--active': currentThemeId === theme.id,
          'appearance-option--disabled': switchingState === 'loading' && currentThemeId !== theme.id,
        }"
        :disabled="switchingState === 'loading'"
        :aria-label="t('layout.appearance.layoutThemeOption', { name: theme.name })"
        :aria-pressed="currentThemeId === theme.id"
        :title="preloadErrors[theme.id] || theme.description"
        @click="emit('selectTheme', theme.id)"
        @mouseenter="emit('preloadTheme', theme.id)"
      >
        <Icon v-if="switchingState !== 'loading' || currentThemeId === theme.id" :name="theme.icon" size="18" />
        <Icon v-else name="lucide:loader-2" size="18" class="appearance-option__spinner" />
        <span class="appearance-option__label">{{ theme.name }}</span>
        <span class="appearance-option__version">v{{ theme.version }}</span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="tooltip">
        <div v-if="engineTipVisible" class="engine-tip-floating" :style="engineTipStyle">
          {{ t('layout.appearance.engineTip') }}
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import type { LayoutThemeMeta } from '~/features/appearance/themeRegistry'

defineProps<{
  currentThemeId: string
  layoutThemeLabel: string
  availableThemes: readonly LayoutThemeMeta[]
  switchingState: 'idle' | 'loading' | 'error'
  preloadErrors: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'selectTheme' | 'preloadTheme', id: string): void
}>()

const { t } = useI18n()

const engineBadgeRef = ref<HTMLElement | null>(null)
const engineTipVisible = ref(false)
const engineTipStyle = ref<Record<string, string>>({})
let engineTipTimer: ReturnType<typeof setTimeout> | null = null

function showEngineTip() {
  if (engineTipTimer) {
    clearTimeout(engineTipTimer)
    engineTipTimer = null
  }
  engineTipTimer = setTimeout(() => {
    const el = engineBadgeRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    const top = rect.top - margin
    let left = rect.left + rect.width / 2

    left = Math.max(margin, Math.min(left, window.innerWidth - margin))

    engineTipStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translate(-50%, -100%)',
    }
    engineTipVisible.value = true
  }, 200)
}

function hideEngineTip() {
  if (engineTipTimer) {
    clearTimeout(engineTipTimer)
    engineTipTimer = null
  }
  engineTipVisible.value = false
}

onBeforeUnmount(() => {
  if (engineTipTimer) clearTimeout(engineTipTimer)
})
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

.appearance-section__status {
  font-size: 0.625rem;
  margin-left: 0.25rem;
}

.appearance-section__status--error {
  color: var(--danger, #ef4444);
}

.appearance-option-grid--theme {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
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
  cursor: var(--interaction-cursor, pointer);
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

.appearance-option__version {
  font-size: 0.5625rem;
  color: var(--text-muted, var(--text-soft));
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.appearance-option--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.appearance-option__spinner {
  animation: spin 0.8s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.appearance-engine-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.25rem;
  color: var(--text-soft);
  vertical-align: middle;
  opacity: 0.55;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    opacity: 1;
  }
}

:global(.engine-tip-floating) {
  position: fixed;
  z-index: 9999;
  width: max-content;
  max-width: min(320px, calc(100vw - 1.5rem));
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  box-shadow: var(--tooltip-shadow);
}
</style>
