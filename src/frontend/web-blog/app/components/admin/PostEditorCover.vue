<!--
  @file PostEditorCover.vue
  @description 文章编辑器的封面：地址与替代文本、从媒体库选择，以及加载失败时的提示与重试
-->
<template>
  <label
    >{{ $t('admin-content.postEditor.cover')
    }}<input
      v-model="draft.cover"
      maxlength="2048"
      :disabled="pending"
      :placeholder="$t('admin-content.postEditor.coverPlaceholder')"
  /></label>
  <label
    >{{ $t('admin-content.postEditor.coverAlt')
    }}<input
      v-model="draft.coverAlt"
      maxlength="300"
      :disabled="pending"
      :placeholder="$t('admin-content.postEditor.coverAltPlaceholder')"
  /></label>
  <button type="button" :disabled="pending" @click="emit('pick')">
    {{ $t('admin-content.postEditor.pickCover') }}
  </button>
  <div v-if="draft.cover" class="post-editor__cover-preview">
    <img
      v-if="!coverFailed"
      :src="draft.cover"
      :alt="draft.coverAlt || $t('admin-content.postEditor.coverPreviewAlt')"
      @error="coverFailed = true"
    />
    <p v-else role="status">
      {{ $t('admin-content.postEditor.coverFailed')
      }}<button type="button" @click="coverFailed = false">{{ $t('admin-content.postEditor.retryCover') }}</button>
    </p>
  </div>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'

defineProps<{ pending: boolean }>()
const draft = defineModel<AdminPostDraft>({ required: true })
const coverFailed = defineModel<boolean>('coverFailed', { required: true })
const emit = defineEmits<{ pick: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/post-editor' as post;

@include post.editor;
</style>
