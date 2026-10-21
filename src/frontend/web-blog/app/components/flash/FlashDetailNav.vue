<!--
  @file FlashDetailNav.vue
  @description 闪念详情页底部的上一条/下一条导航条
  @author TixXin
  @since 2026-10-21
-->

<template>
  <nav class="flash-detail-nav" :aria-label="$t('flash-moment.flashDetail.nav')">
    <NuxtLink v-if="prevNote" :to="`/flash/${prevNote.id}`" class="flash-detail-nav__item flash-detail-nav__item--prev">
      <Icon name="lucide:chevron-left" size="18" class="flash-detail-nav__arrow" />
      <div class="flash-detail-nav__text">
        <span class="flash-detail-nav__label">{{ $t('flash-moment.flashDetail.prev') }}</span>
        <span class="flash-detail-nav__title">{{ truncate(prevNote.content, 40) }}</span>
      </div>
    </NuxtLink>
    <span v-else class="flash-detail-nav__placeholder" />

    <NuxtLink v-if="nextNote" :to="`/flash/${nextNote.id}`" class="flash-detail-nav__item flash-detail-nav__item--next">
      <div class="flash-detail-nav__text">
        <span class="flash-detail-nav__label">{{ $t('flash-moment.flashDetail.next') }}</span>
        <span class="flash-detail-nav__title">{{ truncate(nextNote.content, 40) }}</span>
      </div>
      <Icon name="lucide:chevron-right" size="18" class="flash-detail-nav__arrow" />
    </NuxtLink>
    <span v-else class="flash-detail-nav__placeholder" />
  </nav>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

defineProps<{
  prevNote: FlashNote | null
  nextNote: FlashNote | null
}>()

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ')
  return t.length > n ? `${t.slice(0, n)}…` : t
}
</script>

<style lang="scss" scoped>
.flash-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  // 手机端两列太窄，标题只剩几个字；改为单列并去掉占位
  @media (max-width: $breakpoint-sm) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.flash-detail-nav__item {
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

.flash-detail-nav__placeholder {
  visibility: hidden;

  @media (max-width: $breakpoint-sm) {
    display: none;
  }
}

.flash-detail-nav__arrow {
  flex-shrink: 0;
  color: var(--text-soft);
}

.flash-detail-nav__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.flash-detail-nav__label {
  font-size: 0.75rem;
  color: var(--text-faint);
}

.flash-detail-nav__title {
  font-size: 0.875rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
