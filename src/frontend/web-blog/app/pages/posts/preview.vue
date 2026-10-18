<!-- @file preview.vue @description 凭签名链接阅读最新已保存草稿，复用文章正文且不参与公开互动 -->
<template>
  <div class="main-inner">
    <CommonCustomScrollbar class="post-preview" viewport-class="post-preview__viewport" primary>
      <aside class="post-preview__notice" aria-label="草稿预览说明">
        <strong><Icon name="lucide:file-clock" aria-hidden="true" />预览，尚未发布</strong>
        <p>这里展示最新已保存的草稿。文章修改后，原链接仍有效直到过期；链接有效期为生成后 7 天。</p>
        <p>本页不计浏览，也不开放评论。持有链接的人均可阅读，请谨慎转发。</p>
      </aside>
      <CommonRequestFeedback
        v-if="pending || error || !article"
        :pending="pending"
        :title="error?.message || '预览链接无效或已过期，请向博主获取新的链接。'"
        @retry="refresh"
      />
      <template v-else>
        <ArticleStickyHeader
          :title="article.title"
          :category="article.category"
          :date="article.date"
          :read-time="article.readTime"
        />
        <div class="post-preview__content">
          <div v-if="article.cover" class="post-preview__cover-wrap">
            <CommonContentImage
              v-if="!coverError"
              :src="article.cover"
              :alt="article.coverAlt || article.title"
              class="post-preview__cover"
              referrerpolicy="no-referrer"
              sizes="(min-width: 640px) 80vw, 100vw"
              width="800"
              height="320"
              priority
              @error="coverError = true"
            />
            <p v-else class="post-preview__cover-error" role="status">
              <Icon name="lucide:image-off" aria-hidden="true" />封面加载失败
            </p>
          </div>
          <div class="article-reading-content">
            <ArticleMarkdown v-if="article.contentRaw" :content="article.contentRaw" :title="article.title" />
            <LazyArticleContent v-else :sections="article.content ?? []" />
          </div>
        </div>
      </template>
    </CommonCustomScrollbar>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ rightSidebar: false })
const route = useRoute()
const coverError = ref(false)
// 标题与社交摘要保持通用，草稿标题、正文和签名凭据不进入分享元数据。
usePageSeo({
  title: '草稿预览',
  description: '通过限时分享链接阅读尚未发布的草稿。',
  robots: 'noindex, nofollow, noarchive',
})
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
const { article, pending, error, refresh } = await usePostPreview(() => route.query.token)
watch(article, () => (coverError.value = false))
</script>

<style scoped lang="scss">
.post-preview {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.post-preview__notice {
  padding: 1rem 2rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.7;

  strong {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-main);
  }

  p {
    margin: 0.5rem 0 0;
  }
}

.post-preview__content {
  max-width: 60rem;
  margin-inline: auto;
  padding: 1.5rem 2rem 4rem;
  overflow-wrap: anywhere;
}

.post-preview__cover-wrap {
  margin-bottom: 1.5rem;
  overflow: hidden;
  border-radius: $radius-md;
}

.post-preview__cover {
  display: block;
  width: 100%;
  height: clamp(12rem, 30vw, 20rem);
  object-fit: cover;
}

.post-preview__cover-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 12rem;
  color: var(--text-muted);
  background: var(--surface-2);
}

@media (max-width: 480px) {
  .post-preview__notice {
    padding: 1rem 0.75rem;
  }

  .post-preview__content {
    padding: 1rem 0.75rem 5rem;
  }
}
</style>
