<!--
  @file DevDebugPanel.vue
  @description Dev 全局调试面板：可拖拽 FAB + 侧边/居中抽屉，分 5 个 tab 展示视口/路由/账号/预览/环境
  @author TixXin
  @since 2026-04-11

  仅 dev 阶段使用，调用方（app.vue）必须用 <DevOnly> 包裹保证 prod 构建被 tree-shake。
-->

<template>
  <Teleport to="body">
    <!-- 可拖拽 FAB：dev 调试入口 -->
    <DevDebugFab
      :is-open="isOpen"
      :is-dragging="isDragging"
      :fab-hidden="fabHidden"
      :fab-style="fabStyle"
      @pointerdown="onFabPointerDown"
      @click="onFabClick"
    />

    <!-- 遮罩 -->
    <Transition name="dev-debug-overlay">
      <div v-if="isOpen" class="dev-debug-overlay" @click="close" />
    </Transition>

    <!-- 抽屉：根据 position 切换为 left/right/top/bottom 贴边或 center 浮窗；transitionName 同步切换 -->
    <!-- :key="position" 强制 unmount/remount，让切位置真正走「旧位置 leave + 新位置 enter」两段独立动画 -->
    <Transition :name="transitionName">
      <aside
        v-if="isOpen"
        :key="position"
        class="dev-debug-drawer"
        :class="`dev-debug-drawer--${position}`"
        :style="drawerStyle"
        role="dialog"
        aria-label="Dev 调试面板"
      >
        <DevDebugHeader
          :position="position"
          :font-scale="fontScale"
          @pointerdown="onHeaderPointerDown"
          @decrease-zoom="decreaseFontScale"
          @reset-zoom="resetFontScale"
          @increase-zoom="increaseFontScale"
          @change-position="setPosition"
          @close="close"
        />

        <nav class="dev-debug-drawer__tabs" role="tablist" aria-label="调试分组">
          <button
            v-for="tab in DEBUG_TABS"
            :key="tab.id"
            type="button"
            role="tab"
            class="dev-debug-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="setActiveTab(tab.id)"
          >
            <Icon :name="tab.icon" size="14" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="dev-debug-drawer__body">
          <DevDebugViewportSection v-if="activeTab === 'viewport'" />
          <DevDebugRouteSection v-else-if="activeTab === 'route'" />
          <DevDebugAuthSection v-else-if="activeTab === 'auth'" />
          <DevDebugPreviewSection v-else-if="activeTab === 'preview'" />
          <DevDebugEnvSection v-else-if="activeTab === 'env'" />
        </div>

        <!-- 居中模式：右下角自定义 resize 手柄。原生 resize:both 会和 drawerStyle 的 inline width/height 互相覆盖，必须自管 -->
        <div
          v-if="position === 'center'"
          class="dev-debug-resize-handle"
          aria-label="拖动调整尺寸"
          @pointerdown="onResizePointerDown"
        >
          <Icon name="lucide:move-diagonal-2" size="12" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import DevDebugAuthSection from './debug/DevDebugAuthSection.vue'
import DevDebugEnvSection from './debug/DevDebugEnvSection.vue'
import DevDebugFab from './debug/DevDebugFab.vue'
import DevDebugHeader from './debug/DevDebugHeader.vue'
import DevDebugPreviewSection from './debug/DevDebugPreviewSection.vue'
import DevDebugRouteSection from './debug/DevDebugRouteSection.vue'
import DevDebugViewportSection from './debug/DevDebugViewportSection.vue'

import { DEBUG_TABS } from '~/features/dev/constants'
import { useDevDrawerDrag } from '~/features/dev/useDevDrawerDrag'
import { useDevKeyboardShortcuts } from '~/features/dev/useDevKeyboardShortcuts'
import { useDevViewport } from '~/features/dev/useDevViewport'

const {
  isOpen,
  activeTab,
  fabPosition,
  position,
  centerRect,
  fontScale,
  setActiveTab,
  setFabPosition,
  setPosition,
  setCenterRect,
  increaseFontScale,
  decreaseFontScale,
  resetFontScale,
  reclampFabPosition,
  reclampCenterRect,
  toggle,
  close,
} = useDevDebugPanel()

const {
  transitionName,
  drawerStyle,
  fabStyle,
  isDragging,
  onFabPointerDown,
  onFabClick,
  onHeaderPointerDown,
  onResizePointerDown,
  cleanupDragListeners,
} = useDevDrawerDrag({
  isOpen,
  position,
  fontScale,
  fabPosition,
  centerRect,
  setFabPosition,
  setCenterRect,
  toggle,
})

const { onKeydown } = useDevKeyboardShortcuts(isOpen, toggle, close)
const { fabHidden, syncViewport, syncScroll } = useDevViewport({ isOpen, isDragging })

// 切换到 center 时初始化矩形（首次 x/y = -1 时居中放置）
watch(
  [position, isOpen],
  ([pos, open]) => {
    if (open && pos === 'center') {
      if (centerRect.value.x < 0 || centerRect.value.y < 0) {
        setCenterRect(centerRect.value)
      }
    }
  },
  { immediate: false },
)

function onResize() {
  syncViewport()
  reclampFabPosition()
  reclampCenterRect()
}

onMounted(() => {
  syncViewport()
  syncScroll()
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('scroll', syncScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', syncScroll)
  window.removeEventListener('keydown', onKeydown)
  cleanupDragListeners()
})
</script>

<style lang="scss" scoped>
/* ==================== 遮罩 ==================== */
.dev-debug-overlay {
  position: fixed;
  inset: 0;
  z-index: 9997;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

/* ==================== 抽屉（基类） ==================== */
.dev-debug-drawer {
  position: fixed;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  overflow: hidden;
}

/* 贴边停靠：用 calc(100vh|100vw / var(--dev-debug-zoom)) 反向补偿 zoom，
   避免 zoom 同时缩放 top/bottom 锚点导致面板溢出视口 */

.dev-debug-drawer--left,
.dev-debug-drawer--right {
  top: 0;
  width: min(320px, calc(90vw / var(--dev-debug-zoom, 1)));
  height: calc(100vh / var(--dev-debug-zoom, 1));
}

.dev-debug-drawer--left {
  left: 0;
  border-right: 1px solid var(--border);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
}

.dev-debug-drawer--right {
  right: 0;
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
}

.dev-debug-drawer--top,
.dev-debug-drawer--bottom {
  left: 0;
  width: calc(100vw / var(--dev-debug-zoom, 1));
  height: min(320px, calc(80vh / var(--dev-debug-zoom, 1)));
}

.dev-debug-drawer--top {
  top: 0;
  border-bottom: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.dev-debug-drawer--bottom {
  bottom: 0;
  border-top: 1px solid var(--border);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
}

/* 居中浮窗：可拖拽 + 自定义 resize 手柄 */
.dev-debug-drawer--center {
  border: 1px solid var(--border);
  border-radius: $radius-md;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

/* 自定义右下角 resize 手柄 */
.dev-debug-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.125rem;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, nwse-resize);
  user-select: none;
  touch-action: none;
  transition: color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent);
  }
}

/* ==================== Tabs ==================== */
.dev-debug-drawer__tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-bottom: 1px solid var(--border-soft);
  background: var(--surface-1);
}

.dev-debug-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.625rem 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  border-bottom: 2px solid transparent;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
}

/* ==================== Body ==================== */
.dev-debug-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem 1rem;
}

/* ==================== 进出动画 ==================== */
.dev-debug-overlay-enter-active,
.dev-debug-overlay-leave-active {
  transition: opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-overlay-enter-from,
.dev-debug-overlay-leave-to {
  opacity: 0;
}

/* 贴边停靠动画 */
.dev-debug-drawer-left-enter-active,
.dev-debug-drawer-left-leave-active,
.dev-debug-drawer-right-enter-active,
.dev-debug-drawer-right-leave-active,
.dev-debug-drawer-top-enter-active,
.dev-debug-drawer-top-leave-active,
.dev-debug-drawer-bottom-enter-active,
.dev-debug-drawer-bottom-leave-active {
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.dev-debug-drawer-left-enter-from,
.dev-debug-drawer-left-leave-to {
  transform: translateX(-100%);
}

.dev-debug-drawer-right-enter-from,
.dev-debug-drawer-right-leave-to {
  transform: translateX(100%);
}

.dev-debug-drawer-top-enter-from,
.dev-debug-drawer-top-leave-to {
  transform: translateY(-100%);
}

.dev-debug-drawer-bottom-enter-from,
.dev-debug-drawer-bottom-leave-to {
  transform: translateY(100%);
}

/* 居中浮窗：opacity + scale，更快更紧凑 */
.dev-debug-drawer-center-enter-active,
.dev-debug-drawer-center-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.dev-debug-drawer-center-enter-from,
.dev-debug-drawer-center-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
</style>
