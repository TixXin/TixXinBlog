<!-- @file LinkCard.vue @description 真实友链卡片，图片重试按钮独立于外链，推荐不表示互链验证 -->
<template>
  <article class="link-card" :data-link-id="link.id">
    <CommonImageFrame
      v-if="link.avatar"
      class="link-card__avatar"
      :src="link.avatar"
      :alt="link.name"
      :width="link.width ?? 64"
      :height="link.height ?? 64"
      fit="contain"
    />
    <div v-else class="link-card__placeholder" aria-label="未设置站点图片"><Icon name="lucide:globe" size="28" /></div>
    <h3 class="link-card__name">
      <a :href="link.url" target="_blank" rel="noopener noreferrer"
        >{{ link.name }}<Icon name="lucide:external-link" size="13"
      /></a>
    </h3>
    <span v-if="link.isFeatured" class="link-card__featured">推荐</span>
    <p class="link-card__desc">{{ link.description || '暂未填写站点介绍' }}</p>
    <p class="link-card__domain">{{ link.domain }}</p>
  </article>
</template>
<script setup lang="ts">
import type { LinkItem } from '~/features/link/types'
defineProps<{ link: LinkItem }>()
</script>
<style scoped lang="scss">
.link-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  overflow-wrap: anywhere;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);
  }
}
.link-card__avatar {
  width: 100%;
  max-width: 9rem;
  height: 9rem;
  margin-bottom: 0.75rem;
  border-radius: $radius-md;
}
.link-card__placeholder {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-soft);
  background: var(--surface-2);
  margin-bottom: 0.75rem;
}
.link-card__name {
  margin: 0;
  max-width: 100%;
  font-size: 0.875rem;
  font-weight: 700;
}
.link-card__name a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: var(--text-main);
}
.link-card__name :deep(svg) {
  flex-shrink: 0;
}
.link-card__desc {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.65;
  margin-top: 0.5rem;
}
.link-card__domain {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-top: 0.75rem;
}
.link-card__featured {
  font-size: 0.75rem;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 0.35rem;
  padding: 0.15rem 0.5rem;
}
</style>
