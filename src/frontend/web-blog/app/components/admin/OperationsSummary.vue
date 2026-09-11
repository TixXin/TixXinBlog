<!-- @file OperationsSummary.vue @description 工作台通知与维护摘要分别读取，失败不显示零值或可恢复承诺 -->
<template>
  <section class="operations-summary" aria-labelledby="operations-summary-title">
    <h2 id="operations-summary-title">通知与维护</h2>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || '正在读取通知与维护'"
      :compact="!!data"
      @retry="refresh"
    />
    <template v-if="data">
      <p>
        <NuxtLink to="/admin/notifications"
          >互动通知<span v-if="data.notifications"> · {{ data.notifications.unread }} 条未读</span></NuxtLink
        ><span v-if="!data.notifications"> · 未读数量暂不可用</span>
      </p>
      <p>通知已读不改变上方审核、回复待办。</p>
      <template v-if="data.operations?.runtime">
        <p v-if="data.operations.runtime.failures" role="alert">
          有 {{ data.operations.runtime.failures }} 项失败或不确定任务需要核对。
        </p>
        <p>
          最近备份完整性校验：{{
            data.operations.runtime.lastVerifiedBackup
              ? new Date(data.operations.runtime.lastVerifiedBackup).toLocaleString('zh-CN')
              : '尚无运行记录'
          }}
        </p>
        <p>
          最近恢复演练：{{
            data.operations.runtime.lastRecovery
              ? new Date(data.operations.runtime.lastRecovery).toLocaleString('zh-CN')
              : '尚无运行记录'
          }}
        </p>
        <p v-if="data.operations.backupOverdue || data.operations.storage?.low" role="alert">
          备份逾期或存储空间不足，请查看运行检查。
        </p>
      </template>
      <p v-else role="alert">维护运行记录暂不可用。</p>
      <button
        v-if="!data.notifications || !data.operations?.runtime"
        type="button"
        :disabled="pending"
        @click="refresh"
      >
        重新读取维护摘要
      </button>
    </template>
    <NuxtLink to="/admin/operations">查看运行、投递与备份记录</NuxtLink>
  </section>
</template>
<script setup lang="ts">
import type { OperationStatus } from '~/features/notification/types'
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
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.25rem;
  margin-top: 1.5rem;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1.125rem;
  font-weight: 600;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
a {
  color: var(--accent);
}
button {
  padding: 0.6rem;
  border: 1px solid var(--border);
  color: var(--text-main);
  background: var(--surface-2);
  border-radius: 0.5rem;
}
</style>
