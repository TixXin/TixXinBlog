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

const icon = computed(() => (currentPreference.value === 'dark' ? 'lucide:moon' : 'lucide:sun'))

const label = computed(() => COLOR_MODE_LABELS[currentPreference.value])

/** 若 pointerdown 已切换主题，短时间内忽略紧随其后的 click，避免二次反转 */
let suppressSwitcherClickUntil = 0

function onThemeSwitcherPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  suppressSwitcherClickUntil = Date.now() + 400
  setTheme(currentPreference.value === 'dark' ? 'light' : 'dark', e)
}

function onThemeSwitcherClick(e: MouseEvent) {
  if (Date.now() < suppressSwitcherClickUntil) return
  setTheme(currentPreference.value === 'dark' ? 'light' : 'dark', e)
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
}
</style>
