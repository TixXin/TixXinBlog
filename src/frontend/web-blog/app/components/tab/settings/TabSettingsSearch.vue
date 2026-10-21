<!--
  @file TabSettingsSearch.vue
  @description 标签页设置抽屉 - 搜索与命令面板设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.search.title') }}</h3>
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.search.engine') }}</span>
      </div>
      <div class="tsd-wp-kinds">
        <button
          v-for="opt in searchEngineOptions"
          :key="opt.value"
          type="button"
          class="tsd-opt tsd-wp-kind"
          :class="{ 'tsd-opt--active': s.searchEngine === opt.value }"
          @click="update('searchEngine', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div v-if="s.searchEngine === 'custom'" class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.search.customUrl') }}</span>
      </div>
      <input
        type="text"
        class="tsd-text-input"
        placeholder="https://example.com/search?q=%s"
        :value="s.searchEngineCustomUrl"
        @change="update('searchEngineCustomUrl', ($event.target as HTMLInputElement).value)"
      />
      <p class="tsd-hint">
        <Icon name="lucide:info" size="11" />
        <i18n-t keypath="misc.tab.settings.search.customUrlHint" scope="global">
          <template #placeholder><code>%s</code></template>
        </i18n-t>
      </p>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.search.palette') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.commandPaletteEnabled }"
        @click="update('commandPaletteEnabled', !s.commandPaletteEnabled)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <p class="tsd-hint">
      <Icon name="lucide:keyboard" size="11" />
      {{ $t('misc.tab.settings.search.paletteHint') }}
    </p>
    <button type="button" class="tsd-reset" @click="resetSection('search')">
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

const searchEngineOptions = computed<{ value: 'google' | 'bing' | 'duckduckgo' | 'baidu' | 'custom'; label: string }[]>(
  () => [
    { value: 'google', label: 'Google' },
    { value: 'bing', label: 'Bing' },
    { value: 'duckduckgo', label: 'DuckDuckGo' },
    { value: 'baidu', label: t('misc.tab.search.engine.baidu') },
    { value: 'custom', label: t('misc.tab.settings.search.custom') },
  ],
)
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

.tsd-wp-kinds {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
}

.tsd-wp-kind {
  justify-content: center;
}
</style>
