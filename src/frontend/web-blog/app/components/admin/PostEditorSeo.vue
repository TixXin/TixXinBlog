<!--
  @file PostEditorSeo.vue
  @description 文章编辑器的搜索设置：地址标识、SEO 标题与描述、禁止收录，以及搜索结果预览
-->
<template>
  <section class="post-editor__seo" :aria-label="$t('admin-content.postEditor.seoSection')">
    <h2>{{ $t('admin-content.postEditor.seoSection') }}</h2>
    <label
      >{{ $t('admin-content.postEditor.slug')
      }}<input
        v-model="draft.slug"
        maxlength="120"
        pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*"
        :disabled="pending"
        :placeholder="$t('admin-content.postEditor.slugPlaceholder')"
        @blur="emit('normalizeSlug')"
    /></label>
    <p>{{ $t('admin-content.postEditor.slugHint') }}</p>
    <label
      >{{ $t('admin-content.postEditor.seoTitle')
      }}<input
        v-model="draft.seoTitle"
        maxlength="160"
        :disabled="pending"
        :placeholder="$t('admin-content.postEditor.seoTitlePlaceholder')"
    /></label>
    <label
      >{{ $t('admin-content.postEditor.seoDescription')
      }}<textarea
        v-model="draft.seoDescription"
        maxlength="320"
        rows="3"
        :disabled="pending"
        :placeholder="$t('admin-content.postEditor.seoDescriptionPlaceholder')"
      />
    </label>
    <label class="post-editor__check"
      ><input v-model="draft.seoNoindex" type="checkbox" :disabled="pending" />{{
        $t('admin-content.postEditor.noindex')
      }}</label
    >
    <div class="post-editor__search-preview" :aria-label="$t('admin-content.postEditor.searchPreview')">
      <strong>{{ draft.seoTitle || draft.title || $t('admin-content.postEditor.titlePlaceholder') }}</strong>
      <p>{{ addressPreview }}</p>
      <p>
        {{
          draft.seoDescription ||
          draft.summary ||
          suggestedSummary(draft.contentRaw) ||
          $t('admin-content.postEditor.descriptionPlaceholder')
        }}
      </p>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { suggestedSummary } from '~/utils/postPublishing'

defineProps<{ pending: boolean; addressPreview: string }>()
const draft = defineModel<AdminPostDraft>({ required: true })
const emit = defineEmits<{ normalizeSlug: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/post-editor' as post;

@include post.editor;
</style>
