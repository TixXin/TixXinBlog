<!--
  @file RootLayout.vue
  @description Dock 浮岛布局主题：底部浮岛式导航 + 居中单栏内容
  @author TixXin
  @since 2026-04-03
-->

<template>
  <div class="page-root theme-dock">
    <main class="dock-body">
      <div class="main-content">
        <slot />
      </div>
    </main>

    <div id="right-sidebar-target" class="dock-sidebar-sink" />

    <nav class="dock-bar" aria-label="主导航" @mouseleave="onDockLeave">
      <div class="dock-bar__inner">
        <NuxtLink
          v-for="(item, index) in navItems"
          :key="item.to"
          :to="item.to"
          :aria-label="item.label"
          class="dock-item"
          :class="{ active: isActive(item.to) }"
          :style="getDockItemStyle(index)"
          @mouseenter="onDockItemEnter(index)"
        >
          <Icon :name="item.icon" class="dock-item__icon" />
          <span class="dock-item__label">{{ item.label }}</span>
        </NuxtLink>
        <div class="dock-bar__divider" />
        <div class="dock-item dock-item--action">
          <BlogThemeSwitcher />
        </div>
        <div class="dock-item dock-item--action">
          <BlogAppearanceEntry />
        </div>
        <button
          v-if="windowScroll > 300"
          class="dock-item dock-item--action"
          type="button"
          aria-label="返回顶部"
          @click="returnTop"
        >
          <Icon name="lucide:arrow-up" size="18" />
        </button>
      </div>
    </nav>

    <footer class="dock-footer">
      <ThemeComponent name="StatusFooter" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { scrollToRoot } from '~/utils/scrollRoot'
const route = useRoute()
const { navItems } = useNavItems()
const windowScroll = ref(0)
let scrollFrame = 0
let cancelScroll: (() => void) | undefined
function updateWindowScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    windowScroll.value = window.scrollY
  })
}
function returnTop() {
  cancelScroll = scrollToRoot(null, 0)
}
onMounted(() => {
  updateWindowScroll()
  window.addEventListener('scroll', updateWindowScroll, { passive: true })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(scrollFrame)
  cancelScroll?.()
  window.removeEventListener('scroll', updateWindowScroll)
})

function isActive(to: string) {
  if (route.path === to) return true
  if (to === '/' && route.path === '/moments') return true
  return false
}

const hoveredIndex = ref(-1)
const { reducedMotion } = useMotionPreference()

function onDockItemEnter(index: number) {
  hoveredIndex.value = index
}

function onDockLeave() {
  hoveredIndex.value = -1
}

function getDockItemStyle(index: number): Record<string, string> {
  if (reducedMotion.value || hoveredIndex.value < 0) return {}

  const distance = Math.abs(index - hoveredIndex.value)
  if (distance === 0) {
    return { '--dock-scale': 'var(--dock-icon-scale-hover, 1.3)' }
  }
  if (distance === 1) {
    return { '--dock-scale': 'var(--dock-icon-scale-neighbor, 1.15)' }
  }
  if (distance === 2) {
    return { '--dock-scale': '1.05' }
  }
  return {}
}
</script>

<style lang="scss" scoped>
.theme-dock {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  --dock-bg: color-mix(in srgb, var(--surface-1) 72%, transparent);
  --dock-blur: 20px;
  --dock-shadow: var(--shadow-card);
  --dock-radius: 1.25rem;
  --dock-bottom-offset: 1.5rem;
  --dock-icon-size: 1.5rem;
  --dock-icon-scale-hover: 1.3;
  --dock-icon-scale-neighbor: 1.15;
  --dock-border: 1px solid var(--border-soft);
}

.dock-sidebar-sink {
  display: none;
}

.dock-body {
  flex: 1;
  max-width: 780px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1rem 2rem;

  @media (min-width: $breakpoint-md) {
    padding: 2.5rem 2rem 2rem;
  }

  --post-card-min-h: 140px;
  --post-card-max-h: 190px;
}

// --- Dock 导航栏 ---

.dock-bar {
  position: fixed;
  bottom: var(--dock-bottom-offset);
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  background: var(--dock-bg);
  backdrop-filter: blur(var(--dock-blur));
  border-radius: var(--dock-radius);
  border: var(--dock-border);
  box-shadow: var(--dock-shadow);
  padding: 0.5rem 0.75rem;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: #{$breakpoint-md - 0.02}) {
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    padding: 0.5rem 0.75rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  }
}

.dock-bar__inner {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  @media (max-width: #{$breakpoint-md - 0.02}) {
    overflow-x: auto;
    align-items: center;
    padding-block: 0.25rem;
  }
}

.dock-bar__divider {
  width: 1px;
  height: 1.5rem;
  background: var(--border-soft);
  margin: 0 0.375rem;
  flex-shrink: 0;
  align-self: center;
}

// --- Dock 元素 ---

.dock-item {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.625rem;
  border-radius: $radius-md;
  color: var(--text-soft);
  cursor: pointer;
  transform: scale(var(--dock-scale, 1)) translateY(calc((var(--dock-scale, 1) - 1) * -8px));
  transform-origin: bottom center;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.2s ease,
    background 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.active {
    color: var(--accent-text);
  }

  &--action {
    cursor: default;
    --dock-scale: 1 !important;

    &:hover {
      background: transparent;
    }
  }
}

.dock-item__icon {
  font-size: var(--dock-icon-size);
  flex-shrink: 0;
}

.dock-item__label {
  font-size: 0.625rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;

  @media (max-width: #{$breakpoint-md - 0.02}) {
    display: none;
  }
}

// --- 底栏 ---

.dock-footer {
  max-width: $container-max-width;
  width: 100%;
  margin: 0 auto;
  // 最后的页脚也必须留出浮岛导航空间，移动端状态说明才可悬停和聚焦。
  padding: 0 1rem calc(6rem + env(safe-area-inset-bottom));

  @media (min-width: $breakpoint-md) {
    padding: 0 2rem calc(6rem + env(safe-area-inset-bottom));
  }

  :deep(.site-footer) {
    @media (min-width: $breakpoint-md) {
      display: grid;
    }
  }
}
</style>
