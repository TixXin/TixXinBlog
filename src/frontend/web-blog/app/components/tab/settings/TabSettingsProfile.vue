<!--
  @file TabSettingsProfile.vue
  @description 标签页设置抽屉 - 个人信息分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.profile.title') }}</h3>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.username') }}</span>
      <span class="tsd-row__value">{{ user?.nickname || $t('misc.tab.sidebar.notLoggedIn') }}</span>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.role') }}</span>
      <span class="tsd-row__value tsd-chip">{{
        user?.role === 'owner' ? $t('misc.tab.settings.profile.owner') : $t('misc.tab.settings.profile.guest')
      }}</span>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.email') }}</span>
      <span class="tsd-row__value">{{ user?.email || '—' }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CurrentUser } from '~/features/auth/types'

defineProps<{
  user: CurrentUser | null
}>()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;
</style>
