<!--
  @file ThemeSwitcher.vue
  @description 颜色主题切换按钮，在 light / dark 之间切换
  @author TixXin
  @since 2026-03-24
-->

<template>
  <button
    type="button"
    class="theme-switcher"
    :aria-label="`切换主题（当前：${label}）`"
    @pointerdown="onThemeSwitcherPointerDown"
    @click="onThemeSwitcherClick"
  >
    <ClientOnly>
      <Icon :name="icon" size="18" />
      <template #fallback>
        <Icon name="lucide:moon" size="18" />
      </template>
    </ClientOnly>
  </button>
</template>

<script setup lang="ts">
import { COLOR_MODE_LABELS } from '~/features/appearance/types'

const { currentPreference, setTheme } = useTheme()
const colorMode = useColorMode()

// 以「实际生效模式」决定下次切换目标，避免 preference='system' 时按一次不变的死区
const effectiveMode = computed<'light' | 'dark'>(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
const nextTheme = computed<'light' | 'dark'>(() => (effectiveMode.value === 'dark' ? 'light' : 'dark'))

const icon = computed(() => (effectiveMode.value === 'dark' ? 'lucide:moon' : 'lucide:sun'))

const label = computed(() => COLOR_MODE_LABELS[currentPreference.value])

/** 若 pointerdown 已切换主题，短时间内忽略紧随其后的 click，避免二次反转 */
let suppressSwitcherClickUntil = 0

function onThemeSwitcherPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  suppressSwitcherClickUntil = Date.now() + 400
  setTheme(nextTheme.value, e)
}

function onThemeSwitcherClick(e: MouseEvent) {
  if (Date.now() < suppressSwitcherClickUntil) return
  setTheme(nextTheme.value, e)
}
</script>

<style lang="scss" scoped>
.theme-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  color: var(--text-soft);
  transition: $transition-fast;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &:active {
    transform: scale(0.92);
  }

  // 图标 hover 旋转动效（与齿轮按钮的 rotate(45deg) 形成各自不同的微动效）
  :deep(svg) {
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &:hover :deep(svg) {
    transform: rotate(-180deg);
  }
}
</style>
