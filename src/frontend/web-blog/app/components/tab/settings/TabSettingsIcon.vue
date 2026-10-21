<!--
  @file TabSettingsIcon.vue
  @description 标签页设置抽屉 - 图标设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.icon.title') }}</h3>
    <!-- 图标风格 -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.style') }}</span>
      <div class="tsd-options">
        <button
          v-for="opt in iconStyleOptions"
          :key="opt.value"
          type="button"
          class="tsd-opt"
          :class="{ 'tsd-opt--active': s.iconStyle === opt.value }"
          @click="update('iconStyle', opt.value)"
        >
          <Icon :name="opt.icon" size="14" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>
    <!-- 图标大小 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.size') }}</span>
        <span class="tsd-row__val-badge">{{ s.iconSize }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.iconSize"
        min="32"
        max="80"
        step="2"
        @input="update('iconSize', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 图标圆角 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.radius') }}</span>
        <span class="tsd-row__val-badge">{{ effectiveIconRadius }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.iconRadius"
        min="0"
        :max="Math.floor(s.iconSize / 2)"
        step="1"
        :disabled="s.iconStyle === 'rounded'"
        @input="update('iconRadius', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 不透明度 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.opacity') }}</span>
        <span class="tsd-row__val-badge">{{ Math.round(s.iconOpacity * 100) }}%</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.iconOpacity"
        min="0.2"
        max="1"
        step="0.05"
        @input="update('iconOpacity', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 图标间距 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.gap') }}</span>
        <span class="tsd-row__val-badge">{{ s.iconGap }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.iconGap"
        min="0"
        max="32"
        step="2"
        @input="update('iconGap', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 显示图标名称 -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.showName') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.showIconName }"
        @click="update('showIconName', !s.showIconName)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <!-- 文字大小 -->
    <div class="tsd-row tsd-row--col" :class="{ 'tsd-row--disabled': !s.showIconName }">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.nameSize') }}</span>
        <span class="tsd-row__val-badge">{{ s.nameSize }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.nameSize"
        min="10"
        max="18"
        step="1"
        :disabled="!s.showIconName"
        @input="update('nameSize', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 名称颜色 -->
    <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showIconName }">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.nameColor') }}</span>
      <div class="tsd-color-pick">
        <input
          type="color"
          class="tsd-color-pick__input"
          :value="s.nameColor || '#888888'"
          :disabled="!s.showIconName"
          @input="update('nameColor', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="s.nameColor"
          type="button"
          class="tsd-color-pick__clear"
          :title="$t('misc.tab.settings.icon.resetColor')"
          @click="update('nameColor', '')"
        >
          <Icon name="lucide:x" size="10" />
        </button>
      </div>
    </div>
    <!-- 区域最大宽度 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.maxWidth') }}</span>
        <span class="tsd-row__val-badge">
          {{ s.gridMaxWidth }}{{ s.gridMaxWidthUnit }}
          <button
            type="button"
            class="tsd-unit-toggle"
            @click="update('gridMaxWidthUnit', s.gridMaxWidthUnit === 'px' ? '%' : 'px')"
          >
            {{ $t('misc.tab.settings.icon.switchUnit', { unit: s.gridMaxWidthUnit === 'px' ? '%' : 'px' }) }}
          </button>
        </span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.gridMaxWidth"
        :min="s.gridMaxWidthUnit === 'px' ? 400 : 40"
        :max="s.gridMaxWidthUnit === 'px' ? 2400 : 100"
        :step="s.gridMaxWidthUnit === 'px' ? 10 : 5"
        @input="update('gridMaxWidth', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 自动抓取 favicon -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.faviconAutoFetch') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.faviconAutoFetch }"
        @click="update('faviconAutoFetch', !s.faviconAutoFetch)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <!-- favicon provider -->
    <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.faviconAutoFetch }">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.faviconProvider') }}</span>
      <div class="tsd-options">
        <button
          v-for="opt in faviconProviderOptions"
          :key="opt.value"
          type="button"
          class="tsd-opt"
          :class="{ 'tsd-opt--active': s.faviconProvider === opt.value }"
          :disabled="!s.faviconAutoFetch"
          @click="update('faviconProvider', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <button type="button" class="tsd-reset" @click="resetSection('icon')">
      <Icon name="lucide:rotate-ccw" size="12" />
      {{ $t('misc.tab.settings.resetSection') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FaviconProvider, TabIconStyle } from '~/composables/useTabSettings'
import { useTabSettings } from '~/composables/useTabSettings'

const { t } = useI18n()
const { settings, update, resetSection } = useTabSettings()
const s = settings

/** 圆形模式下圆角 = size/2 */
const effectiveIconRadius = computed(() =>
  s.value.iconStyle === 'rounded' ? Math.floor(s.value.iconSize / 2) : s.value.iconRadius,
)

const iconStyleOptions = computed<{ value: TabIconStyle; label: string; icon: string }[]>(() => [
  { value: 'default', label: t('misc.tab.settings.icon.styles.default'), icon: 'lucide:square' },
  { value: 'rounded', label: t('misc.tab.settings.icon.styles.rounded'), icon: 'lucide:circle' },
  { value: 'flat', label: t('misc.tab.settings.icon.styles.flat'), icon: 'lucide:minus' },
])

const faviconProviderOptions: { value: FaviconProvider; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'icon-horse', label: 'Icon Horse' },
]
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

/* ---- Unit toggle ---- */
.tsd-unit-toggle {
  padding: 0.0625rem 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: transparent;
  color: var(--accent-text);
  font-size: 0.5625rem;
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--accent-soft);
  }
}
</style>
