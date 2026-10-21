<!--
  @file TabSettingsAbout.vue
  @description 标签页设置抽屉 - 关于分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.about.title') }}</h3>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.about.version') }}</span>
      <span class="tsd-row__value tsd-row__value--mono">v1.0.0</span>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.about.author') }}</span>
      <span class="tsd-row__value">{{ ownerCard.name }}</span>
    </div>
    <p class="tsd-about-text">
      {{ $t('misc.tab.settings.about.text') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useSiteInfo } from '~/composables/useSiteInfo'

// 关于卡片的署名沿用博主维护的站点资料，不在组件里写死
const { ownerCard } = useSiteInfo()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

/* ---- About ---- */
.tsd-about-text {
  margin: 0.75rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.7;
  color: var(--text-soft);
}
</style>
