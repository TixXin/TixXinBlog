<!--
  @file ArticleContent.vue
  @description 文章正文块渲染：标题、段落、代码、引用与列表
  @author TixXin
  @since 2026-03-20
-->

<template>
  <article class="article-content">
    <template v-for="(section, index) in sections" :key="index">
      <component
        :is="headingTag(section)"
        v-if="section.type === 'heading'"
        :id="section.id"
        class="article-content__heading"
      >
        {{ section.text }}
      </component>
      <p v-else-if="section.type === 'paragraph'" class="article-content__paragraph">
        {{ section.text }}
      </p>
      <CommonCodeBlock v-else-if="section.type === 'code'" :code="section.text ?? ''" :language="section.language" />
      <blockquote v-else-if="section.type === 'quote'" class="article-content__quote">
        <p>{{ section.text }}</p>
      </blockquote>
      <ul v-else-if="section.type === 'list'" class="article-content__list">
        <li v-for="(item, i) in section.items" :key="i" class="article-content__list-item">
          <span class="article-content__bullet" />
          <span>{{ item }}</span>
        </li>
      </ul>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { ArticleSection } from '~/features/post/types'

defineProps<{
  sections: ArticleSection[]
}>()

function headingTag(section: ArticleSection): 'h2' | 'h3' {
  return section.level === 3 ? 'h3' : 'h2'
}
</script>

<style lang="scss" scoped>
.article-content {
  font-family: $font-family-base;
}

.article-content__heading {
  color: var(--text-main);
  font-weight: 700;
  margin: 0;
  scroll-margin-top: 5rem;

  h2 {
    font-size: 1.25rem;
    margin-top: 2rem;
    margin-bottom: 1rem;

    &:first-child {
      margin-top: 0;
    }
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-main);
  }
}

.article-content__paragraph {
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.article-content__quote {
  margin: 1.5rem 0;
  padding: 0.75rem 0 0.75rem 1.25rem;
  border-left: 4px solid var(--border-hover);
  border-radius: 0 $radius-md $radius-md 0;
  background: var(--surface-3);

  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.7;
    font-style: italic;
    color: var(--text-muted);
  }
}

.article-content__list {
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.article-content__list-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--text-muted);
}

.article-content__bullet {
  margin-top: 0.45rem;
  width: 6px;
  height: 6px;
  border-radius: $radius-full;
  flex-shrink: 0;
  background: var(--text-soft);
}
</style>
