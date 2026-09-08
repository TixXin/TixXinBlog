<!--
  @file AuditLog.vue
  @description 仅根据 props 展示操作者、对象和白名单审计摘要。
-->
<template>
  <ul class="audit-log">
    <li v-for="item in items" :key="item.id" :data-state="item.state">
      <header>
        <h2>{{ item.actionLabel }}</h2>
        <strong>{{ auditStateLabels[item.state] }}</strong>
      </header>
      <p>操作者：{{ item.actor }} · 请求开始 {{ date(item.createdAt) }}</p>
      <p>
        对象：{{ auditResourceLabels[item.resourceType] || '管理对象'
        }}{{ item.resourceId ? ` #${item.resourceId}` : '' }}
        <NuxtLink v-if="auditResourceLink(item)" :to="auditResourceLink(item)">前往相关管理</NuxtLink>
      </p>
      <p v-if="item.finishedAt">
        处理结束 {{ date(item.finishedAt) }}{{ item.statusCode ? ` · HTTP ${item.statusCode}` : '' }}
      </p>
      <p v-if="item.summary.fields.length">提交字段：{{ item.summary.fields.join('、') }}</p>
      <p v-if="item.summary.submittedVersion !== undefined || item.summary.currentVersion !== undefined">
        提交版本 {{ item.summary.submittedVersion ?? '—' }} · 返回版本 {{ item.summary.currentVersion ?? '—' }}
      </p>
      <p v-if="item.summary.targetState">
        目标状态：{{ stateNames[item.summary.targetState] || item.summary.targetState }}
      </p>
      <p v-for="(value, key) in item.summary.counts" :key="key">{{ auditCountLabels[key] || key }}：{{ value }}</p>
      <p v-if="item.state === 'pending' || item.state === 'unknown'">
        结果尚未确认，请核对对象当前状态后决定是否重试。
      </p>
      <small>审计编号 {{ item.id }}{{ item.traceId ? ` · 请求编号 ${item.traceId}` : '' }}</small>
    </li>
  </ul>
</template>
<script setup lang="ts">
import { auditStateLabels, auditResourceLabels, auditCountLabels, auditResourceLink } from '~/features/audit/types'
import type { AuditItem } from '~/features/audit/types'
defineProps<{ items: AuditItem[] }>()
const stateNames: Record<string, string> = {
  draft: '草稿',
  published: '公开/已通过',
  archived: '归档',
  pending: '待审核',
  hidden: '隐藏',
  spam: '垃圾',
  'review-required': '先审核后公开',
  'direct-publication': '直接公开',
}
function date(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>
<style scoped>
.audit-log {
  list-style: none;
  padding: 0;
}
li {
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 1rem;
  border-radius: 0.75rem;
  margin-block: 1rem;
  overflow-wrap: anywhere;
}
header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
}
h2 {
  font-size: 1.1rem;
}
p {
  margin-block: 0.5rem;
}
small {
  color: var(--text-muted);
}
a {
  color: var(--accent);
}
[data-state='failure'] strong {
  color: #ef4444;
}
[data-state='partial'] strong {
  color: #d97706;
}
</style>
