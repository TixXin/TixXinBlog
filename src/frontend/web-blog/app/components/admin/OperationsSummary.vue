<!-- @file OperationsSummary.vue @description 工作台通知与维护摘要分别读取，失败不显示零值或可恢复承诺 -->
<template>
  <section class="operations-summary" aria-labelledby="operations-summary-title">
    <h2 id="operations-summary-title">{{ t('admin-system.opsSummary.title') }}</h2>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || t('admin-system.opsSummary.loading')"
      :compact="!!data"
      @retry="refresh"
    />
    <template v-if="data">
      <p>
        <NuxtLink to="/admin/notifications"
          >{{ t('admin-system.opsSummary.notifications')
          }}<span v-if="data.notifications">
            ·
            {{
              t('admin-system.opsSummary.unread', { count: data.notifications.unread }, data.notifications.unread)
            }}</span
          ></NuxtLink
        ><span v-if="!data.notifications"> · {{ t('admin-system.opsSummary.unreadUnavailable') }}</span>
      </p>
      <p>{{ t('admin-system.opsSummary.readNote') }}</p>
      <template v-if="data.operations?.runtime">
        <p v-if="data.operations.runtime.failures" role="alert">
          {{
            t(
              'admin-system.opsSummary.failures',
              { count: data.operations.runtime.failures },
              data.operations.runtime.failures,
            )
          }}
        </p>
        <p>
          {{
            t('admin-system.opsSummary.lastVerifiedBackup', {
              time: formatDateTime(data.operations.runtime.lastVerifiedBackup) || t('admin-system.opsSummary.noRecord'),
            })
          }}
        </p>
        <p>
          {{
            t('admin-system.opsSummary.lastRecovery', {
              time: formatDateTime(data.operations.runtime.lastRecovery) || t('admin-system.opsSummary.noRecord'),
            })
          }}
        </p>
        <p v-if="data.operations.backupOverdue || data.operations.storage?.low" role="alert">
          {{ t('admin-system.opsSummary.backupWarning') }}
        </p>
      </template>
      <p v-else role="alert">{{ t('admin-system.opsSummary.runtimeUnavailable') }}</p>
      <button
        v-if="!data.notifications || !data.operations?.runtime"
        type="button"
        :disabled="pending"
        @click="refresh"
      >
        {{ t('admin-system.opsSummary.reload') }}
      </button>
    </template>
    <NuxtLink to="/admin/operations">{{ t('admin-system.opsSummary.viewOperations') }}</NuxtLink>
  </section>
</template>
<script setup lang="ts">
import type { OperationStatus } from '~/features/notification/types'
const { t } = useI18n()
const api = useAdminApi()
const { data, pending, error, refresh } = useAdminReadResource(async () => {
  const [notifications, operations] = await Promise.allSettled([
    api<{ unread: number }>('/admin/notifications/summary'),
    api<OperationStatus>('/admin/operations'),
  ])
  return {
    notifications: notifications.status === 'fulfilled' ? notifications.value : null,
    operations: operations.status === 'fulfilled' ? operations.value : null,
  }
})
</script>
<style scoped lang="scss">
.operations-summary {
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  padding: 1.125rem 1.25rem;
  overflow-wrap: anywhere;
  transition: border-color 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
h2 {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
p {
  margin-block: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}
a {
  color: var(--accent-action);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
</style>
