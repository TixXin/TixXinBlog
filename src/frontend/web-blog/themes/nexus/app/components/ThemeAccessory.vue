<!--
  @file ThemeAccessory.vue
  @description Nexus 三栏主题的额外浮动入口，保留移动端界面设置按钮
  @author TixXin
  @since 2026-04-03
-->

<template>
  <div class="nexus-mobile-fab" :class="{ 'is-hidden': hidden }" :inert="hidden || undefined">
    <BlogThemeSwitcher class="nexus-fab-item" />
    <div class="nexus-fab-divider" />
    <BlogAppearanceEntry class="nexus-fab-item" />
  </div>
</template>

<script setup lang="ts">
// 向下滚动时收起浮动入口，避免遮挡正文；向上滚动或回到顶部时恢复
const hidden = ref(false)
let lastY = 0

function onScroll() {
  const y = window.scrollY
  if (Math.abs(y - lastY) < 8) return
  hidden.value = y > 80 && y > lastY
  lastY = y
}

onMounted(() => {
  lastY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<style lang="scss" scoped>
.nexus-mobile-fab {
  position: fixed;
  top: calc(1rem + env(safe-area-inset-top));
  right: 1rem;
  z-index: 60;
  border-radius: $radius-full;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  overflow: visible;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &.is-hidden {
    opacity: 0;
    transform: translateY(calc(-100% - 1rem));
    pointer-events: none;
  }

  &:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card-hover);
  }

  @media (min-width: $breakpoint-lg) {
    display: none;
  }
}

.nexus-fab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--text-soft);
  transition: color var(--motion-fast, 0.16s) ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
  }
}

.nexus-fab-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--border-soft);
  margin: 0 0.25rem;
}
</style>
