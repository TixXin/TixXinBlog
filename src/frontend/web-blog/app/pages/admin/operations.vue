<!-- @file operations.vue @description 管理运行状态、备份校验与投递结果，保留失败和不确定状态 -->
<template>
  <section class="operations">
    <h1>运行状态</h1>
    <p>备份生成、完整性校验、传输和恢复演练分别记录；邮件接受也不等于收件人已经阅读。</p>
    <nav>
      <NuxtLink to="/admin/notifications">互动通知</NuxtLink><NuxtLink to="/admin/maintenance">备份与维护</NuxtLink
      ><button type="button" :disabled="pending" @click="refresh">刷新状态</button>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || '正在读取运行状态'"
      :compact="!!data"
      @retry="refresh"
    />
    <p v-if="error && data" role="status">以下为上次读取结果。</p>
    <p v-if="actionError" role="alert">{{ actionError }}</p>
    <template v-if="data">
      <section aria-label="运行检查">
        <h2>运行检查</h2>
        <p :role="data.databaseAvailable ? undefined : 'alert'">
          数据库：{{ data.databaseAvailable ? '查询正常' : '暂不可用，任务数量未知' }}
        </p>
        <p v-if="data.storage" :role="data.storage.low ? 'alert' : undefined">
          媒体存储剩余 {{ (data.storage.availableBytes / 1024 ** 3).toFixed(1) }} GiB{{
            data.storage.low ? '，空间不足，请处理' : ''
          }}
        </p>
        <p v-else role="alert">媒体存储容量暂不可读取。</p>
        <p>
          邮件：{{
            !data.configured.email.enabled || !data.configured.email.configured
              ? '未启用或配置未完整'
              : data.runtime?.control.externalPaused
                ? '已暂停'
                : '已配置，等待执行器处理'
          }}
        </p>
        <p>
          自动备份：{{
            !data.configured.backup.enabled || !data.configured.backup.configured
              ? '未启用或配置未完整'
              : data.runtime?.control.backupPaused
                ? '已暂停'
                : '已配置，等待执行器调度'
          }}
        </p>
        <p v-if="data.backupOverdue" role="alert">已启用的备份超过两个周期没有完整性校验成功记录。</p>
        <p>通道启用需要环境配置和持久运行开关，应用启动不会自动投递或创建备份。</p>
      </section>
      <template v-if="data.runtime">
        <p>
          最近完整性校验：{{ date(data.runtime.lastVerifiedBackup) }}；最近恢复演练：{{
            date(data.runtime.lastRecovery)
          }}
        </p>
        <p v-if="data.runtime.failures" role="alert">
          {{ data.runtime.failures }} 项任务失败或投递结果不确定，需要核对。
        </p>
        <p v-if="focusedError" role="alert">{{ focusedError }}</p>
        <section v-if="focused" aria-label="指定任务">
          <h2>指定任务</h2>
          <AdminOperationTask :task="focused" :disabled="!!working" @retry="retryTask" />
        </section>
        <h2>任务记录</h2>
        <p v-if="!data.runtime.tasks.length">还没有任务记录。未启用的通道不会报告执行成功。</p>
        <AdminOperationTask
          v-for="task in data.runtime.tasks"
          :key="task.id"
          :task="task"
          :disabled="!!working"
          @retry="retryTask"
        />
        <nav aria-label="任务分页">
          <NuxtLink v-if="page > 1" :to="{ query: { page: page - 1 } }">上一页</NuxtLink
          ><span>{{ page }} / {{ Math.max(1, Math.ceil(data.runtime.total / 20)) }}</span
          ><NuxtLink v-if="page * 20 < data.runtime.total" :to="{ query: { page: page + 1 } }">下一页</NuxtLink>
        </nav>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { OperationStatus, OperationTask } from '~/features/notification/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '运行状态', robots: 'noindex, nofollow' })
const route = useRoute(),
  api = useAdminApi(),
  auth = useCurrentUser()
const contentContext = useState<string>('page-content-context', () => '')
const page = computed(() => Math.max(1, Number.isSafeInteger(Number(route.query.page)) ? Number(route.query.page) : 1))
const { data, pending, error, refresh, captureOwnership } = useAdminReadResource(
  () => api<OperationStatus>('/admin/operations', { query: { page: page.value } }),
  '运行状态不可用，请检查 API 后重试',
)
const focused = ref<OperationTask | null>(null),
  focusedError = ref(''),
  working = ref(''),
  actionError = ref('')
let version = 0,
  alive = true
function date(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚无记录'
}
async function focusTask() {
  const turn = ++version
  const owns = captureOwnership()
  focused.value = null
  focusedError.value = ''
  const id = typeof route.query.task === 'string' ? route.query.task : ''
  if (!id || !data.value) return
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    focusedError.value = '任务编号无效'
    return
  }
  try {
    const task = await api<OperationTask>(`/admin/operations/tasks/${id}`)
    if (alive && turn === version && owns()) focused.value = task
  } catch {
    if (alive && turn === version && owns()) focusedError.value = '指定任务不存在或暂时无法读取'
  }
}
watch(
  () => route.fullPath,
  () => {
    void refresh()
  },
)
watch(
  [() => route.fullPath, () => auth.currentUser.value?.id, contentContext],
  () => {
    version++
    focused.value = null
    focusedError.value = ''
    working.value = ''
    actionError.value = ''
  },
  { flush: 'sync' },
)
watch(data, () => {
  void focusTask()
})
onScopeDispose(() => {
  alive = false
  version++
})
async function retryTask(task: OperationTask) {
  if (working.value || !['failed', 'uncertain', 'restored'].includes(task.state)) return
  const acknowledgement =
    task.state === 'uncertain'
      ? '已核对未送达并承担重复投递风险'
      : task.state === 'restored'
        ? '明确重新投递恢复前任务'
        : '重试失败任务'
  if (!window.confirm(`${acknowledgement}？此操作会将该任务重新放入执行队列，已启用的通道可能实际投递。`)) return
  const owns = captureOwnership()
  working.value = task.id
  actionError.value = ''
  try {
    await api(`/admin/operations/tasks/${task.id}/retry`, {
      method: 'POST',
      body: { expectedState: task.state, expectedAttempts: task.attempts, acknowledgement },
    })
    if (owns()) {
      await refresh()
      await nextTick()
      if (owns()) document.querySelector<HTMLElement>(`[data-operation-task-id="${task.id}"]`)?.focus()
    }
  } catch {
    if (owns()) actionError.value = '重试未确认，或状态已变化/通道已暂停。请刷新核对后再操作。'
  } finally {
    if (owns()) working.value = ''
  }
}
</script>
<style scoped lang="scss">
.operations {
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.5rem;
}
h2 {
  font-size: 1.15rem;
  margin-block: 1rem;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
[role='alert'] {
  color: var(--text-main);
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-block: 1rem;
  align-items: center;
}
a {
  color: var(--accent);
}
button {
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
</style>
