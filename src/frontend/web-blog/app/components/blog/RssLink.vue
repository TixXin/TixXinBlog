<!--
  @file RssLink.vue
  @description 页面与订阅卡共用的 RSS 入口，保留原生链接、键盘提示与可访问名称
  @author TixXin
  @since 2026-10-18
-->
<template>
  <!-- 订阅文件由 Nitro 直接输出，使用原生链接，避免交给客户端路由 -->
  <CommonTooltip :content="`订阅${label} RSS`">
    <a
      :href="href"
      type="application/rss+xml"
      class="rss-link"
      :class="compact ? 'rss-link--compact' : 'btn-primary'"
      :aria-label="`订阅${label} RSS`"
    >
      <Icon name="lucide:rss" size="16" aria-hidden="true" />
      <span>{{ compact ? 'RSS' : `${label} RSS` }}</span>
    </a>
  </CommonTooltip>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ href: string; label: string; compact?: boolean }>(), { compact: false })
</script>

<style lang="scss" scoped>
.rss-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  width: 100%;
  border-radius: $radius-md;
  text-decoration: none;
  cursor: var(--interaction-cursor, pointer);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &--compact {
    flex-shrink: 0;
    width: auto;
    min-width: 44px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-main);
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color 0.18s,
      border-color 0.18s;

    &:hover {
      border-color: var(--border-hover);
      background: var(--surface-3);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}
</style>
