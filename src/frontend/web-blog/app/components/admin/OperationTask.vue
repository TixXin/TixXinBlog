<!-- @file OperationTask.vue @description 任务记录按真实执行结果展示，外部发送与抑制不混为成功投递 -->
<template>
  <article class="operation-task" :data-operation-task-id="task.id" tabindex="-1">
    <h3>
      {{ task.outcome?.recoveryVerified ? '恢复校验记录' : task.kind === 'mail' ? '互动邮件' : '完整备份' }} ·
      {{ labels[task.state] ?? task.state }}
    </h3>
    <p>{{ new Date(task.createdAt).toLocaleString('zh-CN') }} · 已尝试 {{ task.attempts }} 次</p>
    <p v-if="task.outcome?.suppressed">对应事项已处理或不可用，已停止此次提醒，没有发送邮件。</p>
    <p v-else-if="task.kind === 'mail' && task.outcome?.accepted">SMTP 服务已接受本次邮件。</p>
    <p v-if="task.kind === 'backup' && task.outcome?.integrityVerified">
      备份完整性校验通过。{{
        task.outcome.transferConfigured
          ? task.outcome.transferVerified
            ? '传输副本已验证。'
            : '传输副本尚未验证。'
          : '未配置异地传输。'
      }}{{ task.outcome.recoveryVerified ? '已记录恢复验证。' : '尚无本次恢复演练记录。' }}
    </p>
    <p v-if="task.state === 'uncertain'">
      {{
        task.outcome?.accepted
          ? 'SMTP 已接受，但执行结果记录出现异常；核对后再决定是否重试，重复投递有风险。'
          : '无法确认远端是否已接受，请核对捕获服务或收件情况后再决定是否重试。'
      }}
    </p>
    <p v-if="task.state === 'restored'">这是恢复出来的旧任务，默认暂停，不会自动重复投递。</p>
    <p v-if="task.outcome?.recoveryVerified">已在独立目标完成数据库与媒体恢复校验。</p>
    <p v-if="task.errorCode">错误类型：{{ task.errorCode }}</p>
    <button
      v-if="['failed', 'uncertain', 'restored'].includes(task.state)"
      type="button"
      :disabled="disabled"
      @click="$emit('retry', task)"
    >
      核对并重试
    </button>
  </article>
</template>
<script setup lang="ts">
import type { OperationTask } from '~/features/notification/types'
defineProps<{ task: OperationTask; disabled?: boolean }>()
defineEmits<{ retry: [task: OperationTask] }>()
const labels: Record<string, string> = {
  queued: '等待执行',
  running: '执行中',
  retry: '等待重试',
  succeeded: '处理完成',
  failed: '执行失败',
  uncertain: '投递结果不确定',
  paused: '未启用或已暂停',
  restored: '恢复后暂停',
}
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
