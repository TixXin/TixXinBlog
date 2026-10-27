<!-- @file MomentCommentItem.vue @description 朋友圈管理页评论面板中的评论条目：作者、审核状态与内容，公开、隐藏与删除入口；定位目标可聚焦 -->
<template>
  <li :data-comment-id="comment.id" :data-comment-target="targeted" :tabindex="targeted ? -1 : undefined">
    <strong>{{ comment.author }}{{ comment.isOwner ? $t('admin-content.moments.ownerSuffix') : '' }}</strong
    ><span> · {{ $t(`admin-content.moments.commentStatus.${comment.moderationStatus ?? 'published'}`) }}</span>
    <p>{{ comment.content }}</p>
    <div class="admin-moments__actions">
      <button
        v-if="comment.moderationStatus !== 'published'"
        type="button"
        :disabled="busy"
        @click="emit('moderate', 'published')"
      >
        {{ $t('admin-content.moments.publishComment') }}
      </button>
      <button
        v-if="comment.moderationStatus !== 'hidden'"
        type="button"
        :disabled="busy"
        @click="emit('moderate', 'hidden')"
      >
        {{ $t('admin-content.moments.hideComment') }}
      </button>
      <button type="button" :disabled="busy" @click="emit('remove')">
        {{ $t('admin-content.moments.removeComment') }}
      </button>
    </div>
  </li>
</template>
<script setup lang="ts">
import type { MomentCommentItem } from '~/features/moment/types'

defineProps<{ comment: MomentCommentItem; targeted: boolean; busy: boolean }>()
const emit = defineEmits<{ moderate: [status: 'published' | 'hidden']; remove: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-moments' as moments;

@include moments.page;
</style>
