<!--
  @file TabSettingsData.vue
  @description 标签页设置抽屉 - 数据管理设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.data.title') }}</h3>
    <p class="tsd-hint">
      <Icon name="lucide:info" size="11" />
      {{ $t('misc.tab.settings.data.hint') }}
    </p>
    <div class="tsd-data-actions">
      <button type="button" class="tsd-data-btn" @click="onExport">
        <Icon name="lucide:download" size="14" />
        <div>
          <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.export') }}</div>
          <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.exportDesc') }}</div>
        </div>
      </button>
      <button type="button" class="tsd-data-btn" @click="emit('openImport')">
        <Icon name="lucide:upload" size="14" />
        <div>
          <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.import') }}</div>
          <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.importDesc') }}</div>
        </div>
      </button>
      <button type="button" class="tsd-data-btn tsd-data-btn--danger" @click="onClearBookmarks">
        <Icon name="lucide:trash-2" size="14" />
        <div>
          <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.clear') }}</div>
          <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.clearDesc') }}</div>
        </div>
      </button>
      <button type="button" class="tsd-data-btn tsd-data-btn--danger" @click="onResetSettings">
        <Icon name="lucide:rotate-ccw" size="14" />
        <div>
          <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.reset') }}</div>
          <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.resetDesc') }}</div>
        </div>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useTabDataActions } from '~/features/tab/useTabDataActions'

const emit = defineEmits<{ openImport: [] }>()
const { onExport, onClearBookmarks, onResetSettings } = useTabDataActions()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

/* ---- 数据管理按钮 ---- */
.tsd-data-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tsd-data-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-main);
  text-align: left;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  &--danger:hover {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
  }
}

.tsd-data-btn__title {
  font-size: 0.8125rem;
  font-weight: 600;
}

.tsd-data-btn__desc {
  font-size: 0.6875rem;
  color: var(--text-soft);
  margin-top: 0.125rem;
}

.tsd-data-btn:hover .tsd-data-btn__desc,
.tsd-data-btn--danger:hover .tsd-data-btn__desc {
  color: inherit;
  opacity: 0.8;
}
</style>
