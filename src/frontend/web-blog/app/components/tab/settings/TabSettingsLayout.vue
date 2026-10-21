<!--
  @file TabSettingsLayout.vue
  @description 标签页设置抽屉 - 布局设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.layout.title') }}</h3>
    <!-- 视图模式：四格缩略卡 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.viewMode') }}</span>
      </div>
      <div class="tsd-view-grid">
        <button
          v-for="opt in viewModeOptions"
          :key="opt.value"
          type="button"
          class="tsd-view-card"
          :class="{ 'tsd-view-card--active': s.viewMode === opt.value }"
          :title="opt.desc"
          @click="update('viewMode', opt.value)"
        >
          <Icon :name="opt.icon" size="20" />
          <span class="tsd-view-card__label">{{ opt.label }}</span>
        </button>
      </div>
    </div>
    <!-- 列数（仅 grid/compact） -->
    <div
      class="tsd-row tsd-row--col"
      :class="{ 'tsd-row--disabled': s.viewMode !== 'grid' && s.viewMode !== 'compact' }"
    >
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.columns') }}</span>
        <span class="tsd-row__val-badge">
          {{
            s.gridColumns === 'auto'
              ? $t('misc.tab.settings.layout.columnsAuto')
              : $t('misc.tab.settings.layout.columnsCount', { count: s.gridColumns }, s.gridColumns)
          }}
        </span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.gridColumns === 'auto' ? 0 : s.gridColumns"
        min="0"
        max="10"
        step="1"
        :disabled="s.viewMode !== 'grid' && s.viewMode !== 'compact'"
        @input="onGridColumnsChange(($event.target as HTMLInputElement).value)"
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
    <!-- 启用拖拽 -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.dragEnabled') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.dragEnabled }"
        @click="update('dragEnabled', !s.dragEnabled)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <p class="tsd-hint">
      <Icon name="lucide:info" size="11" />
      {{ $t('misc.tab.settings.layout.dragHint') }}
    </p>
    <button type="button" class="tsd-reset" @click="resetSection('view')">
      <Icon name="lucide:rotate-ccw" size="12" />
      {{ $t('misc.tab.settings.resetSection') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTabSettings } from '~/composables/useTabSettings'

const { t } = useI18n()
const { settings, update, resetSection } = useTabSettings()
const s = settings

const viewModeOptions = computed(() =>
  (
    [
      { value: 'grid', icon: 'lucide:layout-grid' },
      { value: 'compact', icon: 'lucide:grid-2x2' },
      { value: 'list', icon: 'lucide:list' },
      { value: 'cards', icon: 'lucide:square-stack' },
    ] as const
  ).map((opt) => ({
    ...opt,
    label: t(`misc.tab.viewMode.${opt.value}`),
    desc: t(`misc.tab.settings.layout.viewModeDesc.${opt.value}`),
  })),
)

/** 列数滑块：0 表示自适应，1-10 表示固定列数 */
function onGridColumnsChange(v: string) {
  const n = Number(v)
  update('gridColumns', n === 0 ? 'auto' : n)
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

/* ---- 视图模式四格缩略卡 ---- */
.tsd-view-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.tsd-view-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  &--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
}

.tsd-view-card__label {
  font-size: 0.6875rem;
  font-weight: 500;
}
</style>
