<!-- @file ProjectRecoveryDetails.vue @description 项目恢复副本完整只读字段，旧封面只展示编号供重新选择 -->
<template>
  <dl class="recovery-details">
    <dt>项目标题</dt>
    <dd>{{ value.title || '未填写' }}</dd>
    <dt>项目介绍</dt>
    <dd>{{ value.description || '未填写' }}</dd>
    <dt>项目进展 / 发布状态 / 排序值</dt>
    <dd>
      {{ projectProgressLabels[value.progress] }} / {{ projectStatusLabels[value.status] }} / {{ value.sortOrder }}
    </dd>
    <dt>技术标签</dt>
    <dd>
      <ul v-if="value.tags.length">
        <li v-for="(tag, index) in value.tags" :key="index">{{ tag.label || '名称未填写' }}（{{ tag.color }}）</li>
      </ul>
      <template v-else>未填写</template>
    </dd>
    <dt>项目链接</dt>
    <dd>
      <ul v-if="value.links.length">
        <li v-for="(link, index) in value.links" :key="index">
          {{ projectLinkLabels[link.kind] }}：{{ link.href || '地址未填写' }}
        </li>
      </ul>
      <template v-else>未填写</template>
    </dd>
    <dt>原有序关联编号</dt>
    <dd>{{ contentRelationSummary(value.relatedContent) }}</dd>
    <dt>原封面编号</dt>
    <dd>
      {{ value.coverMediaId || '未设置封面' }}
      <p v-if="value.coverMediaId">跨内容库的副本不会重新绑定旧封面，请从当前媒体库核对并选择图片。</p>
    </dd>
  </dl>
</template>
<script setup lang="ts">
import { projectProgressLabels, projectStatusLabels, projectLinkLabels } from '~/features/project/types'
import type { ProjectEditable } from '~/features/project/types'
import { contentRelationSummary } from '~/features/content-relation/editor'
defineProps<{ value: ProjectEditable }>()
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
ul {
  margin: 0;
  padding-left: 1.25rem;
}
</style>
