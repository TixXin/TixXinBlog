<!--
  @file TabSettingsTime.vue
  @description 标签页设置抽屉 - 时间与问候语设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.time.title') }}</h3>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showGreeting') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.showGreeting }"
        @click="update('showGreeting', !s.showGreeting)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showDate') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.showDate }"
        @click="update('showDate', !s.showDate)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showDate }">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showSeconds') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.showSeconds }"
        :disabled="!s.showDate"
        @click="update('showSeconds', !s.showSeconds)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <button type="button" class="tsd-reset" @click="resetSection('time')">
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
