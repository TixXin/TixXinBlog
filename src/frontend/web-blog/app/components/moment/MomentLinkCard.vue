<!--
  @file MomentLinkCard.vue
  @description 朋友圈动态中引用的外部链接卡片，含 favicon、域名、OG 图，新窗口打开
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div class="moment-link-card" :class="{ 'has-image': !!link.image }">
    <div v-if="link.image" class="moment-link-card__cover">
      <CommonImageFrame
        :key="link.image"
        :src="link.image"
        :alt="link.title"
        loading="lazy"
        sizes="80px"
        compact
        @state="updateCoverFailure(link.image, $event)"
      />
      <a
        v-if="!coverFailures[link.image]"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="$t('flash-moment.linkCard.open', { title: link.title })"
        class="moment-link-card__cover-link"
      />
    </div>
    <a :href="link.url" target="_blank" rel="noopener noreferrer" class="moment-link-card__body">
      <div class="moment-link-card__head">
        <img
          v-if="link.favicon && !faviconError"
          :src="link.favicon"
          alt=""
          class="moment-link-card__favicon"
          @error="faviconError = true"
        />
        <Icon v-else name="lucide:link" size="12" class="moment-link-card__favicon-fallback" />
        <span class="moment-link-card__site">{{ siteLabel }}</span>
        <Icon name="lucide:external-link" size="12" class="moment-link-card__external" />
      </div>
      <div class="moment-link-card__title">{{ link.title }}</div>
      <p v-if="link.description" class="moment-link-card__desc">{{ link.description }}</p>
    </a>
  </div>
</template>

<script setup lang="ts">
import type { MomentLinkedLink } from '~/features/moment/types'

const props = defineProps<{
  link: MomentLinkedLink
}>()

const faviconError = ref(false)
const coverFailures = ref<Record<string, boolean>>({})
function updateCoverFailure(source: string | undefined, state: 'loading' | 'ready' | 'error' | 'empty') {
  // 图片恢复前不让覆盖链接挡住重试，换图时按地址隔离状态。
  if (source && state !== 'loading') coverFailures.value[source] = state === 'error'
}

// 站点名优先用显式声明，回退到从 URL 提取 host
const siteLabel = computed(() => {
  if (props.link.siteName) return props.link.siteName
  try {
    return new URL(props.link.url).host.replace(/^www\./, '')
  } catch {
    return props.link.url
  }
})
</script>

<style lang="scss" scoped>
.moment-link-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  text-decoration: none;
  color: inherit;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  overflow: hidden;

  &:hover {
    border-color: var(--accent);
    background: var(--surface-3);

    .moment-link-card__external {
      color: var(--accent-text);
    }
  }
}

.moment-link-card__cover {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 60px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);

  :deep(.image-frame) {
    width: 100%;
    height: 100%;
  }
}

.moment-link-card__cover-link {
  position: absolute;
  inset: 0;
  border-radius: inherit;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }
}

.moment-link-card__body {
  text-decoration: none;
  color: inherit;
  border-radius: $radius-sm;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
}

.moment-link-card__head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
  line-height: 1;
}

.moment-link-card__favicon {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  object-fit: contain;
}

.moment-link-card__favicon-fallback {
  color: var(--text-faint);
}

.moment-link-card__site {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.moment-link-card__external {
  flex-shrink: 0;
  color: var(--text-faint);
  transition: color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.moment-link-card__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.moment-link-card__desc {
  font-size: 0.75rem;
  color: var(--text-soft);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
