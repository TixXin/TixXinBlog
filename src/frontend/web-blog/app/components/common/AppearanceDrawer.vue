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
        <div v-if="isDrawerOpen" ref="backdropRef" class="appearance-drawer__overlay" @click="closeDrawer" />
      </Transition>

      <Transition name="drawer-panel">
        <aside
          v-if="isDrawerOpen"
          ref="dialogRef"
          class="appearance-drawer card"
          role="dialog"
          aria-modal="true"
          :aria-label="t('layout.appearance.title')"
          tabindex="-1"
        >
          <header class="appearance-drawer__heading">
            <h2>{{ t('layout.appearance.title') }}</h2>
            <button type="button" :aria-label="t('layout.appearance.close')" @click="closeDrawer">
              <Icon name="lucide:x" size="18" />
            </button>
          </header>
          <div class="appearance-drawer__body">
            <CommonAppearanceColorModeSection
              v-if="isCapabilitySupported('colorMode')"
              :current-preference="currentPreference"
              :theme-options="themeOptions"
              :theme-label="themeLabel"
              :color-mode-transition-label="colorModeTransitionLabel"
              :color-mode-transition-preset="colorModeTransitionPreset"
              :color-mode-transition-options="colorModeTransitionOptions"
              @select-theme="setTheme"
              @update-transition="setColorModeTransitionPreset"
            />

            <CommonAppearanceThemeSection
              :current-theme-id="currentThemeId"
              :layout-theme-label="layoutThemeLabel"
              :available-themes="availableThemes"
              :switching-state="switchingState"
              :preload-errors="preloadErrors"
              @select-theme="onLayoutThemeClick"
              @preload-theme="preloadTheme"
            />

            <CommonAppearanceAnimationSection
              :is-capability-supported="isCapabilitySupported"
              :content-transition-label="contentTransitionLabel"
              :content-transition-preset="contentTransitionPreset"
              :content-transition-options="contentTransitionOptions"
              :sidebar-animation-label="sidebarAnimationLabel"
              :sidebar-animation-preset="sidebarAnimationPreset"
              :sidebar-animation-options="sidebarAnimationOptions"
              @update-content-transition="setContentTransitionPreset"
              @update-sidebar-animation="setSidebarAnimationPreset"
            />

            <section class="appearance-section" data-testid="appearance-locale">
              <div class="appearance-section__head">
                <h3 class="appearance-section__title">
                  <Icon name="lucide:languages" size="14" class="appearance-section__icon" aria-hidden="true" />
                  {{ t('common.locale.title') }}
                </h3>
              </div>
              <LayoutLocaleSwitch />
            </section>
          </div>

          <section class="appearance-section">
            <div class="appearance-section__head">
              <h3 class="appearance-section__title">{{ t('layout.appearance.otherTitle') }}</h3>
            </div>
            <label class="appearance-toggle">
              <span class="appearance-toggle__label">{{ t('layout.appearance.paginationAutoHide') }}</span>
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
            <button type="button" class="appearance-drawer__reset" @click="resetAppearanceSettings">
              {{ t('layout.appearance.reset') }}
            </button>
          </footer>
        </aside>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import CommonAppearanceColorModeSection from '~/components/common/appearance/AppearanceColorModeSection.vue'
import CommonAppearanceThemeSection from '~/components/common/appearance/AppearanceThemeSection.vue'
import CommonAppearanceAnimationSection from '~/components/common/appearance/AppearanceAnimationSection.vue'

const { t } = useI18n()

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
  colorModeTransitionPreset,
  colorModeTransitionOptions,
  colorModeTransitionLabel,
  setColorModeTransitionPreset,
  paginationAutoHide,
  togglePaginationAutoHide,
  resetAppearanceSettings,
} = useAppearanceSettings()

const { currentThemeId, activeTheme, availableThemes, switchingState, setLayoutTheme, preloadTheme, preloadErrors } =
  useLayoutTheme()
const dialogRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
useModalFocus(isDrawerOpen, dialogRef, { close: closeDrawer, extra: () => [backdropRef.value] })

const layoutThemeLabel = computed(() => activeTheme.value.name)

function onLayoutThemeClick(id: string) {
  setLayoutTheme(id)
  // 成功触发切换后立即关闭界面设置弹窗，让用户直接看到新布局
  closeDrawer()
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
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.appearance-drawer__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  h2 {
    font-size: 1rem;
    margin: 0;
  }
  button {
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    border-radius: $radius-sm;
  }
}
.appearance-drawer__overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  // 半透明遮罩提供层级分隔；避免每帧重新采样整个博客背景。
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

.appearance-section__icon {
  margin-right: 0.375rem;
  color: var(--text-soft);
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.2s,
    border-color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .appearance-toggle__switch--on & {
    transform: translateX(1rem);
  }
}

:global(.drawer-overlay-enter-active),
:global(.drawer-overlay-leave-active) {
  transition: opacity 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

:global(.drawer-panel-enter-from),
:global(.drawer-panel-leave-to) {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 8px));
}

:global(.drawer-panel-enter-to),
:global(.drawer-panel-leave-from) {
  transform: translate(-50%, -50%);
}
</style>
