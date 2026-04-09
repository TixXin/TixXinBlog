<!--
  @file AppearanceDrawer.vue
  @description 全局界面设置弹出面板，视口居中显示，集中管理颜色主题、主内容动画与右侧栏动画
  @author TixXin
  @since 2026-03-20
-->

<template>
  <ClientOnly>
    <!-- 遮罩与面板 Teleport 到 body，面板固定定位视口居中避免溢出 -->
    <Teleport to="body">
      <Transition name="drawer-overlay">
        <div v-if="isDrawerOpen" class="appearance-drawer__overlay" @click="closeDrawer" />
      </Transition>

      <Transition name="drawer-panel">
        <aside v-if="isDrawerOpen" class="appearance-drawer card">
          <div class="appearance-drawer__body">
            <section v-if="isCapabilitySupported('colorMode')" class="appearance-section appearance-section--first">
              <div class="appearance-section__head">
                <h3 class="appearance-section__title">颜色主题</h3>
                <span class="appearance-section__value">{{ themeLabel }}</span>
              </div>
              <div class="appearance-option-grid appearance-option-grid--theme">
                <button
                  v-for="option in themeOptions"
                  :key="option"
                  type="button"
                  class="appearance-option"
                  :class="{ 'appearance-option--active': currentPreference === option }"
                  @click="setTheme(option)"
                >
                  <Icon :name="themeIcons[option]" size="18" />
                  <span class="appearance-option__label">{{ themeLabels[option] }}</span>
                </button>
              </div>
            </section>

            <section class="appearance-section">
              <div class="appearance-section__head">
                <h3 class="appearance-section__title">
                  布局主题
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
                  <span v-if="switchingState === 'loading'" class="appearance-section__status">切换中…</span>
                  <span
                    v-else-if="switchingState === 'error'"
                    class="appearance-section__status appearance-section__status--error"
                    >切换失败</span
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
                  :aria-label="`${theme.name} 布局主题`"
                  @click="setLayoutTheme(theme.id)"
                  @mouseenter="preloadTheme(theme.id)"
                >
                  <Icon
                    v-if="switchingState !== 'loading' || currentThemeId === theme.id"
                    :name="theme.icon"
                    size="18"
                  />
                  <Icon v-else name="lucide:loader-2" size="18" class="appearance-option__spinner" />
                  <span class="appearance-option__label">{{ theme.name }}</span>
                  <span class="appearance-option__version">v{{ theme.version }}</span>
                </button>
              </div>
            </section>

            <section v-if="isCapabilitySupported('contentTransition')" class="appearance-section">
              <div class="appearance-section__head">
                <h3 class="appearance-section__title">主内容切换</h3>
                <span class="appearance-section__value">{{ contentTransitionLabel }}</span>
              </div>
              <div class="appearance-option-grid appearance-option-grid--anim">
                <button
                  v-for="option in contentTransitionOptions"
                  :key="option.value"
                  type="button"
                  class="appearance-option"
                  :class="{ 'appearance-option--active': contentTransitionPreset === option.value }"
                  @click="setContentTransitionPreset(option.value)"
                >
                  <Icon :name="option.icon || 'lucide:sparkles'" size="18" />
                  <span class="appearance-option__label">{{ option.label }}</span>
                </button>
              </div>
            </section>

            <section v-if="isCapabilitySupported('sidebarAnimation')" class="appearance-section">
              <div class="appearance-section__head">
                <h3 class="appearance-section__title">右侧栏动画</h3>
                <span class="appearance-section__value">{{ sidebarAnimationLabel }}</span>
              </div>
              <div class="appearance-option-grid appearance-option-grid--anim">
                <button
                  v-for="option in sidebarAnimationOptions"
                  :key="option.value"
                  type="button"
                  class="appearance-option"
                  :class="{ 'appearance-option--active': sidebarAnimationPreset === option.value }"
                  @click="setSidebarAnimationPreset(option.value)"
                >
                  <Icon :name="option.icon || 'lucide:panel-left-open'" size="18" />
                  <span class="appearance-option__label">{{ option.label }}</span>
                </button>
              </div>
            </section>
          </div>

          <section class="appearance-section">
            <div class="appearance-section__head">
              <h3 class="appearance-section__title">其他</h3>
            </div>
            <label class="appearance-toggle">
              <span class="appearance-toggle__label">分页栏随滚动自动隐藏</span>
              <button
                type="button"
                class="appearance-toggle__switch"
                :class="{ 'appearance-toggle__switch--on': paginationAutoHide }"
                role="switch"
                :aria-checked="paginationAutoHide"
                @click="togglePaginationAutoHide"
              >
                <span class="appearance-toggle__thumb" />
              </button>
            </label>
          </section>

          <footer class="appearance-drawer__footer">
            <button type="button" class="appearance-drawer__reset" @click="resetAppearanceSettings">恢复默认</button>
          </footer>
        </aside>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="tooltip">
        <div v-if="engineTipVisible" class="engine-tip-floating" :style="engineTipStyle">
          由 @tixxin/nuxt-theme-engine 驱动（MIT License）
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { COLOR_MODE_LABELS } from '~/features/appearance/types'

const {
  isDrawerOpen,
  isCapabilitySupported,
  closeDrawer,
  currentPreference,
  themeOptions,
  setTheme,
  themeLabel,
  contentTransitionPreset,
  contentTransitionOptions,
  contentTransitionLabel,
  setContentTransitionPreset,
  sidebarAnimationPreset,
  sidebarAnimationOptions,
  sidebarAnimationLabel,
  setSidebarAnimationPreset,
  paginationAutoHide,
  togglePaginationAutoHide,
  resetAppearanceSettings,
} = useAppearanceSettings()

const { currentThemeId, activeTheme, availableThemes, switchingState, setLayoutTheme, preloadTheme } = useLayoutTheme()

const layoutThemeLabel = computed(() => activeTheme.value.name)

const themeLabels = COLOR_MODE_LABELS

const themeIcons = {
  light: 'lucide:sun',
  system: 'lucide:monitor',
  dark: 'lucide:moon',
}

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

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isDrawerOpen.value) {
    closeDrawer()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (engineTipTimer) clearTimeout(engineTipTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.appearance-drawer__overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  z-index: 79;
}

/* 固定定位、视口居中，避免任意分辨率下溢出 */
.appearance-drawer {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(29rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 4rem);
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem;
  overflow: hidden;
  z-index: 80;
}

.appearance-drawer__body {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}

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
}

.appearance-section__status {
  font-size: 0.625rem;
  margin-left: 0.25rem;
}

.appearance-section__status--error {
  color: var(--danger, #ef4444);
}

.appearance-drawer__footer {
  flex-shrink: 0;
  margin-top: 0.75rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--border-soft);
}

.appearance-drawer__reset {
  width: 100%;
  padding: 0.4rem 1rem;
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.75rem;
  font-weight: 700;
  transition: $transition-fast;

  &:hover {
    background: var(--surface-3);
  }
}

// ---- 开关切换 ----
.appearance-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  cursor: pointer;
}

.appearance-toggle__label {
  font-size: 0.75rem;
  color: var(--text-main);
}

.appearance-toggle__switch {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 1.25rem;
  border-radius: $radius-full;
  background: var(--surface-3);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;

  &--on {
    background: var(--accent);
    border-color: var(--accent);
  }
}

.appearance-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease;

  .appearance-toggle__switch--on & {
    transform: translateX(1rem);
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

  &:hover {
    color: var(--accent);
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

:global(.drawer-overlay-enter-active),
:global(.drawer-overlay-leave-active) {
  transition: opacity 0.18s ease;
}

:global(.drawer-overlay-enter-from),
:global(.drawer-overlay-leave-to) {
  opacity: 0;
}

/* 面板弹出动画：自下而上浮入，最终视口居中 */
:global(.drawer-panel-enter-active),
:global(.drawer-panel-leave-active) {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

:global(.drawer-panel-enter-from),
:global(.drawer-panel-leave-to) {
  opacity: 0;
  transform: translate(-50%, 16px);
}

:global(.drawer-panel-enter-to),
:global(.drawer-panel-leave-from) {
  transform: translate(-50%, -50%);
}
</style>
