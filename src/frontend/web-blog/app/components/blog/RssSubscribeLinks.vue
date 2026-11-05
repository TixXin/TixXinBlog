<!--
  @file RssSubscribeLinks.vue
  @description RSS 订阅弹窗的外部入口：第三方阅读器添加链接、新标签页查看源文件与其他订阅格式
  @author TixXin
  @since 2026-11-05
-->

<template>
  <div class="rss-links">
    <!-- 第三方阅读器：只是跳转链接，本站服务器不向它们发请求 -->
    <div class="rss-links__section">
      <span class="rss-links__title">{{ $t('article.rss.modal.readers') }}</span>
      <div class="rss-links__readers">
        <a
          v-for="reader in readers"
          :key="reader.name"
          :href="reader.url"
          target="_blank"
          rel="noopener noreferrer"
          class="rss-links__reader"
        >
          <Icon name="lucide:external-link" size="14" aria-hidden="true" />
          {{ reader.name }}
        </a>
      </div>
    </div>

    <!-- data-rss-native：源文件与其他格式保持原生链接，不被全站订阅链接接管 -->
    <footer class="rss-links__footer" data-rss-native>
      <a :href="feed.path" target="_blank" rel="noopener" type="application/rss+xml" class="rss-links__raw">
        <Icon name="lucide:file-code" size="14" aria-hidden="true" />
        {{ $t('article.rss.modal.viewSource') }}
      </a>
      <span v-if="feed.formats.length" class="rss-links__formats">
        {{ $t('article.rss.modal.otherFormats') }}
        <a
          v-for="format in feed.formats"
          :key="format.path"
          :href="format.path"
          target="_blank"
          rel="noopener"
          class="rss-links__format"
          >{{ format.label }}</a
        >
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { readerSubscribeLinks } from '~/features/feed/rssFeeds'
import type { RssFeed } from '~/features/feed/rssFeeds'

const props = defineProps<{ feed: RssFeed; feedUrl: string }>()
const readers = computed(() => readerSubscribeLinks(props.feedUrl))
</script>

<style lang="scss" scoped>
.rss-links {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.rss-links__section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.rss-links__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.rss-links__readers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.rss-links__reader {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  text-decoration: none;

  &:hover {
    border-color: var(--border-hover);
    background: var(--surface-3);
  }
}

.rss-links__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.rss-links__raw,
.rss-links__format {
  color: var(--accent-text);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.rss-links__raw {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.rss-links__formats {
  display: inline-flex;
  gap: 0.5rem;
}

.rss-links__reader,
.rss-links__raw,
.rss-links__format {
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
</style>
