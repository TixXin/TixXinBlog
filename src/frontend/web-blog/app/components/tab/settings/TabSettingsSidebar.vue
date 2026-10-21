<!--
  @file TabSettingsSidebar.vue
  @description 标签页设置抽屉 - 侧边栏设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.sidebar.title') }}</h3>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.defaultCollapsed') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.defaultCollapsed }"
        @click="update('defaultCollapsed', !s.defaultCollapsed)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.showCounts') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.showCounts }"
        @click="update('showCounts', !s.showCounts)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.radius') }}</span>
        <span class="tsd-row__val-badge">{{ s.sidebarRadius }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.sidebarRadius"
        min="0"
        max="24"
        step="1"
        @input="update('sidebarRadius', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.opacity') }}</span>
        <span class="tsd-row__val-badge">{{ Math.round(s.sidebarOpacity * 100) }}%</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.sidebarOpacity"
        min="0.3"
        max="1"
        step="0.05"
        @input="update('sidebarOpacity', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.blur') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.sidebarBlur }"
        @click="update('sidebarBlur', !s.sidebarBlur)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <button type="button" class="tsd-reset" @click="resetSection('sidebar')">
      <Icon name="lucide:rotate-ccw" size="12" />
      {{ $t('misc.tab.settings.resetSection') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { useTabSettings } from '~/composables/useTabSettings'

const { settings, update, resetSection } = useTabSettings()
const s = settings
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;
</style>
