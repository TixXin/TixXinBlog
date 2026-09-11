<!-- @file GalleryRecoveryDetails.vue @description 图库恢复副本完整只读字段，跨内容库不展示或绑定旧媒体文件 -->
<template>
  <dl class="recovery-details">
    <dt>图片来源</dt>
    <dd>{{ value.source === 'external' ? '外部图片 URL' : '媒体库图片' }}</dd>
    <dt>保留的外部图片地址</dt>
    <dd>{{ value.externalUrl || '未填写' }}</dd>
    <dt>作品标题</dt>
    <dd>{{ value.title || '未填写' }}</dd>
    <dt>作品说明</dt>
    <dd>{{ value.description || '未填写' }}</dd>
    <dt>分类</dt>
    <dd>{{ value.category || '未分类' }}</dd>
    <dt>拍摄日期</dt>
    <dd>{{ value.takenOn || '未填写' }}</dd>
    <dt>拍摄地点</dt>
    <dd>{{ value.location || '未填写' }}</dd>
    <dt>拍摄器材</dt>
    <dd>{{ value.device || '未填写' }}</dd>
    <dt>发布状态 / 排序值</dt>
    <dd>{{ statusLabels[value.status] }} / {{ value.sortOrder }}</dd>
    <dt>原有序关联编号</dt>
    <dd>{{ contentRelationSummary(value.relatedContent) }}</dd>
    <dt>原图片编号</dt>
    <dd>
      {{ value.mediaId || '未选择图片' }}
      <p v-if="value.mediaId">跨内容库的副本不会重新绑定旧图片，请从当前媒体库核对并选择。</p>
    </dd>
  </dl>
</template>
<script setup lang="ts">
import type { GalleryEditable } from '~/features/gallery/types'
import { contentRelationSummary } from '~/features/content-relation/editor'
defineProps<{ value: GalleryEditable }>()
const statusLabels = { draft: '草稿', published: '已公开', withdrawn: '已撤回' }
</script>
<style scoped>
.recovery-details {
  display: grid;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}
dt {
  font-weight: 600;
  margin-top: 0.5rem;
}
dd {
  margin: 0;
  color: var(--text-muted);
  white-space: pre-wrap;
}
</style>
