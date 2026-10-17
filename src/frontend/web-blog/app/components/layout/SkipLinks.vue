<!--
  @file SkipLinks.vue
  @description 跳转链接：平时隐藏、键盘获焦时显示，提供“跳到主内容”和“跳到导航”；
               主内容统一为 #main-content，导航优先主题主导航 #site-navigation，不可见时退回移动导航
  @author TixXin
  @since 2026-10-18
-->

<template>
  <div class="skip-links">
    <a class="skip-links__link" href="#main-content" @click.prevent="toMain">跳到主内容</a>
    <a class="skip-links__link" href="#site-navigation" @click.prevent="toNavigation">跳到导航</a>
  </div>
</template>

<script setup lang="ts">
const focusableSelector = 'a[href],button:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])'

function isVisible(element: Element) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

/** 主内容容器自带 tabindex=-1，直接聚焦并滚到可见位置 */
function toMain() {
  const main = document.getElementById('main-content')
  if (!main) return
  main.focus({ preventScroll: true })
  main.scrollIntoView({ block: 'start' })
}

/** 聚焦可见导航里的第一个链接；桌面主导航隐藏时（窄屏）使用移动导航 */
function toNavigation() {
  const nav = ['#site-navigation', '.mobile-nav']
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((element): element is HTMLElement => !!element && isVisible(element))
  const target = [...(nav?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])].find(
    (element) => isVisible(element) && !element.closest('[inert]'),
  )
  target?.focus()
}
</script>

<style lang="scss" scoped>
.skip-links {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

// 未获焦时移出视口但仍可被 Tab 聚焦；获焦后完整显示
.skip-links__link {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-card-hover);
  border: 1px solid var(--border-hover);
  transform: translateY(calc(-100% - 1.5rem));
  pointer-events: auto;

  &:focus {
    transform: none;
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
</style>
