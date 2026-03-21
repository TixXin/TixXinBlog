<!--
  @file AppearanceEntry.vue
  @description 界面设置齿轮按钮，桌面端嵌入底部栏右侧，移动端固定于右上角
  @author TixXin
  @since 2026-03-20
-->

<template>
  <button
    class="appearance-fab"
    :class="{ 'appearance-fab--open': isDrawerOpen }"
    type="button"
    aria-label="界面设置"
    @click="toggleDrawer"
  >
    <Icon name="lucide:settings" size="18" class="appearance-fab__icon" />
  </button>
</template>

<script setup lang="ts">
const { isDrawerOpen, toggleDrawer } = useAppearanceSettings()
</script>

<style lang="scss" scoped>
/* 全局 _base.scss 对 button 设了 background/border:none，卡片视觉由外层 .footer-appearance 承担 */
button.appearance-fab {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-soft);
  cursor: pointer;
  transition: $transition-fast;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
  /* 去掉默认 outline，避免与外层圆角卡片错位；键盘 Tab 时用 focus-visible 圆角环 */
  outline: none;

  &:focus:not(:focus-visible) {
    outline: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent);
    border-radius: $radius-md;
  }

  &:hover {
    color: var(--text-main);
  }

  &:active {
    transform: scale(0.96);
  }

  &--open {
    color: var(--text-main);
  }

  /* 桌面端：与 .footer-appearance 同高，aspect-ratio 保证正方形，图标 flex 居中 */
  @media (min-width: $breakpoint-xl) {
    position: static;
    flex: 0 0 auto;
    align-self: center;
    width: auto;
    height: 100%;
    max-height: 100%;
    aspect-ratio: 1;
    min-width: 0;
  }
}

.appearance-fab__icon {
  transition: transform 0.3s ease;

  .appearance-fab:hover & {
    transform: rotate(45deg);
  }

  .appearance-fab--open & {
    transform: rotate(90deg);
  }
}
</style>
