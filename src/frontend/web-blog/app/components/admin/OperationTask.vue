<!-- @file OperationTask.vue @description 任务记录按真实执行结果展示，外部发送与抑制不混为成功投递 -->
<template>
  <article class="operation-task" :data-operation-task-id="task.id" tabindex="-1">
    <h3>
      {{
        task.outcome?.recoveryVerified
          ? t('admin-system.operationTask.kindRecovery')
          : task.kind === 'mail'
            ? t('admin-system.operationTask.kindMail')
            : t('admin-system.operationTask.kindBackup')
      }}
      · {{ states.includes(task.state) ? t(`admin-system.operationTask.state.${task.state}`) : task.state }}
    </h3>
    <p>
      {{ formatDateTime(task.createdAt) }} ·
      {{ t('admin-system.operationTask.attempts', { count: task.attempts }, task.attempts) }}
    </p>
    <p v-if="task.outcome?.suppressed">{{ t('admin-system.operationTask.suppressed') }}</p>
    <p v-else-if="task.kind === 'mail' && task.outcome?.accepted">{{ t('admin-system.operationTask.accepted') }}</p>
    <p v-if="task.kind === 'backup' && task.outcome?.integrityVerified">
      {{ t('admin-system.operationTask.integrityVerified')
      }}{{
        task.outcome.transferConfigured
          ? task.outcome.transferVerified
            ? t('admin-system.operationTask.transferVerified')
            : t('admin-system.operationTask.transferUnverified')
          : t('admin-system.operationTask.transferNotConfigured')
      }}{{
        task.outcome.recoveryVerified
          ? t('admin-system.operationTask.recoveryRecorded')
          : t('admin-system.operationTask.recoveryMissing')
      }}
    </p>
    <p v-if="task.state === 'uncertain'">
      {{
        task.outcome?.accepted
          ? t('admin-system.operationTask.uncertainAccepted')
          : t('admin-system.operationTask.uncertainUnknown')
      }}
    </p>
    <p v-if="task.state === 'restored'">{{ t('admin-system.operationTask.restored') }}</p>
    <p v-if="task.outcome?.recoveryVerified">{{ t('admin-system.operationTask.recoveryVerified') }}</p>
    <p v-if="task.errorCode">{{ t('admin-system.operationTask.errorCode', { code: task.errorCode }) }}</p>
    <button
      v-if="['failed', 'uncertain', 'restored'].includes(task.state)"
      type="button"
      :disabled="disabled"
      @click="$emit('retry', task)"
    >
      {{ t('admin-system.operationTask.retry') }}
    </button>
  </article>
</template>
<script setup lang="ts">
import type { OperationTask } from '~/features/notification/types'
defineProps<{ task: OperationTask; disabled?: boolean }>()
defineEmits<{ retry: [task: OperationTask] }>()
const { t } = useI18n()
// 有字典名称的任务状态，未知状态原样显示
const states = ['queued', 'running', 'retry', 'succeeded', 'failed', 'uncertain', 'paused', 'restored']
</script>
<style scoped lang="scss">
.operation-task {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-block: 1rem;
  overflow-wrap: anywhere;
}
h3 {
  font-weight: 600;
}
p {
  margin-block: 0.5rem;
  color: var(--text-muted);
}
button {
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
</style>
