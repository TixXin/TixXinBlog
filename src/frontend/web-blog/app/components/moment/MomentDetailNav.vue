<!--
  @file MomentDetailNav.vue
  @description 朋友圈详情页上一条与下一条动态导航条
  @author TixXin
  @since 2026-04-20
-->

<template>
  <nav class="moment-detail-nav" :aria-label="$t('flash-moment.momentDetail.nav')">
    <NuxtLink
      v-if="prevMoment"
      :to="{ path: `/moments/${prevMoment.id}`, query: filterQuery }"
      class="moment-detail-nav__item moment-detail-nav__item--prev"
    >
      <Icon name="lucide:chevron-left" size="18" class="moment-detail-nav__arrow" />
      <div class="moment-detail-nav__text">
        <span class="moment-detail-nav__label">{{ $t('flash-moment.momentDetail.prev') }}</span>
        <span class="moment-detail-nav__title">{{ truncate(prevMoment.content, 40) }}</span>
      </div>
    </NuxtLink>
    <span v-else class="moment-detail-nav__placeholder" />

    <NuxtLink
      v-if="nextMoment"
      :to="{ path: `/moments/${nextMoment.id}`, query: filterQuery }"
      class="moment-detail-nav__item moment-detail-nav__item--next"
    >
      <div class="moment-detail-nav__text">
        <span class="moment-detail-nav__label">{{ $t('flash-moment.momentDetail.next') }}</span>
        <span class="moment-detail-nav__title">{{ truncate(nextMoment.content, 40) }}</span>
      </div>
      <Icon name="lucide:chevron-right" size="18" class="moment-detail-nav__arrow" />
    </NuxtLink>
    <span v-else class="moment-detail-nav__placeholder" />
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  prevMoment: { id: string; content: string } | null
  nextMoment: { id: string; content: string } | null
  filterQuery?: Record<string, string>
}>()

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) + '…' : value
}
</script>

<style lang="scss" scoped>
.moment-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.moment-detail-nav__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  color: inherit;
  text-decoration: none;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  min-width: 0;

  &:hover {
    background: var(--surface-3);
    border-color: var(--border);
    transform: translateY(-1px);
  }

  &--next {
    justify-content: flex-end;
    text-align: right;
  }
}

.moment-detail-nav__placeholder {
  visibility: hidden;
}

.moment-detail-nav__arrow {
  flex-shrink: 0;
  color: var(--text-soft);
}

.moment-detail-nav__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.moment-detail-nav__label {
  font-size: 0.75rem;
  color: var(--text-faint);
}

.moment-detail-nav__title {
  font-size: 0.875rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
