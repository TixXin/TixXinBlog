<!--
  @file ThemeSwitcher.vue
  @description 颜色主题切换按钮，在 light / dark 之间切换
  @author TixXin
  @since 2026-03-24
-->

<template>
  <button type="button" class="theme-switcher" :aria-label="`切换主题（当前：${label}）`" @click="cycleTheme">
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

function cycleTheme() {
  setTheme(currentPreference.value === 'dark' ? 'light' : 'dark')
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
