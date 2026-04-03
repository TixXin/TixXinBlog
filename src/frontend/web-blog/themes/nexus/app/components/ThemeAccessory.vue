<!--
  @file ThemeAccessory.vue
  @description Nexus 三栏主题的额外浮动入口，保留移动端界面设置按钮
  @author TixXin
  @since 2026-04-03
-->

<template>
  <div class="nexus-mobile-fab">
    <BlogAppearanceEntry />
  </div>
</template>

<style lang="scss" scoped>
.nexus-mobile-fab {
  position: fixed;
  top: calc(1rem + env(safe-area-inset-top));
  right: 1rem;
  z-index: 82;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card-hover);
  }

  @media (min-width: $breakpoint-lg) {
    display: none;
  }
}
</style>
