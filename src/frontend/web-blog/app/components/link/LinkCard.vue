<!--
  @file LinkCard.vue
  @description 真实友链卡片：左侧统一尺寸的站点图标，右侧名称、两行描述与域名；整张卡片可点击在新标签页打开，
    图片重试按钮浮在链接之上独立可用；推荐只表示博主推荐，不表示已验证互链
-->
<template>
  <article class="link-card" :class="{ 'link-card--featured': link.isFeatured }" :data-link-id="link.id">
    <div class="link-card__logo">
      <CommonImageFrame
        v-if="link.avatar"
        :src="link.avatar"
        :alt="link.name"
        :width="link.width ?? 64"
        :height="link.height ?? 64"
        fit="contain"
        compact
      />
      <div v-else class="link-card__placeholder" role="img" :aria-label="$t('interaction.linkCard.noImage')">
        <Icon name="lucide:globe" size="22" />
      </div>
    </div>
    <div class="link-card__body">
      <h2 class="link-card__heading">
        <!-- ::after 铺满整张卡片，整卡可点；可访问名称只取站点名 -->
        <a class="link-card__name" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.name }}</a>
        <span v-if="link.isFeatured" class="link-card__featured">{{ $t('interaction.linkCard.featured') }}</span>
      </h2>
      <p class="link-card__desc">{{ link.description || $t('interaction.linkCard.noDescription') }}</p>
      <p class="link-card__domain">{{ link.domain }}</p>
    </div>
    <Icon name="lucide:arrow-up-right" size="16" class="link-card__external" aria-hidden="true" />
  </article>
</template>
<script setup lang="ts">
import type { LinkItem } from '~/features/link/types'
defineProps<{ link: LinkItem }>()
</script>
<style scoped lang="scss">
.link-card {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem 2.25rem 1rem 1rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  overflow-wrap: anywhere;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);
  }
  // 焦点框画在整张卡片上，与整卡可点一致
  &:has(.link-card__name:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
// 图标与占位统一 48px 方框，宽 Logo 按比例缩进框内，不再拉成横幅
.link-card__logo {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  border-radius: $radius-md;
  background: var(--surface-2);
  overflow: hidden;
  // 图标区域点击穿透到整卡链接，只有破图时的重试按钮可点
  pointer-events: none;
  :deep(.image-frame) {
    width: 100%;
    height: 100%;
    background: transparent;
  }
  :deep(button) {
    pointer-events: auto;
  }
  // 48px 方框放不下「加载中」文字，加载期间只保留底色
  :deep(span.image-frame__status) {
    display: none;
  }
}
.link-card__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-soft);
}
.link-card__body {
  flex: 1;
  min-width: 0;
}
.link-card__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.4;
}
.link-card__name {
  color: var(--text-main);
  text-decoration: none;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  &:focus-visible {
    outline: none;
  }
}
.link-card:hover .link-card__name {
  color: var(--accent-text);
}
.link-card__featured {
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: 0.35rem;
  padding: 0.2rem 0.4rem;
}
.link-card__desc {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.link-card__domain {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link-card__external {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  color: var(--text-soft);
  opacity: 0.5;
  transition:
    opacity 0.18s,
    color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.link-card:hover .link-card__external,
.link-card:has(.link-card__name:focus-visible) .link-card__external {
  opacity: 1;
  color: var(--accent-text);
}
</style>
