<!--
  @file ActiveSessions.vue
  @description 以最小设备信息展示活跃会话，管理动作由页面传入。
-->
<template>
  <section class="active-sessions" :aria-label="t('admin-system.sessions.label')">
    <h2>{{ t('admin-system.sessions.title') }}</h2>
    <p>{{ t('admin-system.sessions.revokeNote') }}</p>
    <p>{{ t('admin-system.sessions.deviceNote') }}</p>
    <div class="active-sessions__toolbar">
      <button type="button" :disabled="pending || disabled" @click="$emit('load', page)">
        {{ t('admin-system.sessions.refresh') }}
      </button>
      <button type="button" :disabled="pending || disabled || total <= 1" @click="$emit('revoke-others')">
        {{ t('admin-system.sessions.revokeOthers') }}
      </button>
    </div>
    <p v-if="pending" role="status">{{ t('admin-system.sessions.pending') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul>
      <li v-for="item in items" :key="item.id" :data-session-id="item.id">
        <h3>{{ item.device }}{{ item.current ? t('admin-system.sessions.currentSuffix') : '' }}</h3>
        <p>
          {{
            t('admin-system.sessions.loginAt', {
              time: item.loginAt ? date(item.loginAt) : t('admin-system.sessions.loginAtUnknown'),
            })
          }}
        </p>
        <p>{{ t('admin-system.sessions.refreshedAt', { time: date(item.lastRefreshedAt) }) }}</p>
        <p>{{ t('admin-system.sessions.expiresAt', { time: date(item.expiresAt) }) }}</p>
        <button type="button" :disabled="pending || disabled" @click="$emit('revoke', item)">
          {{ item.current ? t('admin-system.sessions.revokeCurrent') : t('admin-system.sessions.revoke') }}
        </button>
      </li>
    </ul>
    <p v-if="!pending && !error && !items.length">{{ t('admin-system.sessions.empty') }}</p>
    <nav class="active-sessions__pagination" :aria-label="t('admin-system.sessions.pagination')">
      <button type="button" :disabled="pending || disabled || page <= 1" @click="$emit('load', page - 1)">
        {{ t('admin-system.sessions.prev') }}
      </button>
      <span>
        {{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} ·
        {{ t('admin-system.sessions.total', { count: total }, total) }}
      </span>
      <button type="button" :disabled="pending || disabled || page * 20 >= total" @click="$emit('load', page + 1)">
        {{ t('admin-system.sessions.next') }}
      </button>
    </nav>
  </section>
</template>
<script setup lang="ts">
import type { AdminSessionItem } from '~/features/auth/sessionTypes'
defineProps<{
  items: AdminSessionItem[]
  total: number
  page: number
  pending: boolean
  error: string
  disabled: boolean
}>()
defineEmits<{ load: [page: number]; revoke: [item: AdminSessionItem]; 'revoke-others': [] }>()
const { t } = useI18n()
function date(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped>
.active-sessions {
  min-width: 0;
  margin-top: 2rem;
  overflow-wrap: anywhere;
}
.active-sessions__toolbar,
.active-sessions__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.active-sessions__toolbar button,
.active-sessions__pagination button {
  margin: 0;
  min-height: 44px;
  white-space: normal;
}
h2 {
  font-size: 1.2rem;
}
h3 {
  font-weight: 600;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
ul {
  padding: 0;
  list-style: none;
}
li {
  min-width: 0;
  padding: 1rem;
  margin-block: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
button {
  margin: 0.25rem;
}
</style>
