<!--
  @file AuditLog.vue
  @description 仅根据 props 展示操作者、对象和白名单审计摘要。
-->
<template>
  <ul class="audit-log">
    <li v-for="item in items" :key="item.id" :data-state="item.state">
      <header class="audit-log__header">
        <h2>{{ item.actionLabel }}</h2>
        <strong>{{ t(`admin-system.audit.states.${item.state}`) }}</strong>
      </header>
      <p>{{ t('admin-system.auditLog.actor', { actor: item.actor, time: date(item.createdAt) }) }}</p>
      <p>
        {{ t('admin-system.auditLog.resource', { resource: auditResourceLabel(item.resourceType, t) })
        }}{{ item.resourceId ? ` #${item.resourceId}` : '' }}
        <NuxtLink v-if="auditResourceLink(item)" :to="auditResourceLink(item)">{{
          t('admin-system.auditLog.openResource')
        }}</NuxtLink>
      </p>
      <p v-if="item.finishedAt">
        {{ t('admin-system.auditLog.finished', { time: date(item.finishedAt) })
        }}{{ item.statusCode ? ` · HTTP ${item.statusCode}` : '' }}
      </p>
      <p v-if="item.summary.fields.length">
        {{
          t('admin-system.auditLog.fields', {
            fields: item.summary.fields.join(t('admin-system.auditLog.fieldSeparator')),
          })
        }}
      </p>
      <p v-if="item.summary.submittedVersion !== undefined || item.summary.currentVersion !== undefined">
        {{
          t('admin-system.auditLog.versions', {
            submitted: item.summary.submittedVersion ?? '—',
            current: item.summary.currentVersion ?? '—',
          })
        }}
      </p>
      <p v-if="item.summary.targetState">
        {{
          t('admin-system.auditLog.targetState', {
            state: targetStates.includes(item.summary.targetState)
              ? t(`admin-system.auditLog.targetStates.${item.summary.targetState}`)
              : item.summary.targetState,
          })
        }}
      </p>
      <p v-for="(value, key) in item.summary.counts" :key="key">
        {{ t('admin-system.auditLog.count', { label: auditCountLabel(String(key), t), value }) }}
      </p>
      <p v-if="item.state === 'pending' || item.state === 'unknown'">
        {{ t('admin-system.auditLog.unconfirmed') }}
      </p>
      <small
        >{{ t('admin-system.auditLog.auditId', { id: item.id })
        }}{{ item.traceId ? t('admin-system.auditLog.traceId', { id: item.traceId }) : '' }}</small
      >
    </li>
  </ul>
</template>
<script setup lang="ts">
import { auditResourceLabel, auditCountLabel, auditResourceLink } from '~/features/audit/types'
import type { AuditItem } from '~/features/audit/types'
defineProps<{ items: AuditItem[] }>()
const { t } = useI18n()
// 有字典名称的目标状态，未知状态原样显示
const targetStates = [
  'draft',
  'published',
  'archived',
  'pending',
  'hidden',
  'spam',
  'review-required',
  'direct-publication',
]
function date(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped>
.audit-log {
  list-style: none;
  padding: 0;
  min-width: 0;
}
li {
  min-width: 0;
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 1rem;
  border-radius: 0.75rem;
  margin-block: 1rem;
  overflow-wrap: anywhere;
}
.audit-log__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
}
h2 {
  min-width: 0;
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
