<!-- @file operations.vue @description 管理运行状态、备份校验与投递结果，保留失败和不确定状态 -->
<template>
  <section class="operations">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-system.operations.title') }}</h1>
        <p>{{ t('admin-system.operations.intro') }}</p>
      </div>
    </header>
    <nav class="operations__toolbar" :aria-label="t('admin-system.operations.toolbar')">
      <NuxtLink to="/admin/notifications">{{ t('admin-system.nav.notifications') }}</NuxtLink
      ><NuxtLink to="/admin/maintenance">{{ t('admin-system.nav.maintenance') }}</NuxtLink
      ><button type="button" :disabled="pending" @click="refresh">{{ t('admin-system.operations.refresh') }}</button>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || t('admin-system.operations.loading')"
      :compact="!!data"
      @retry="refresh"
    />
    <p v-if="error && data" role="status">{{ t('admin-system.operations.stale') }}</p>
    <p v-if="actionError" role="alert">{{ actionError }}</p>
    <template v-if="data">
      <section :aria-label="t('admin-system.operations.checks')">
        <h2>{{ t('admin-system.operations.checks') }}</h2>
        <p :role="data.databaseAvailable ? undefined : 'alert'">
          {{
            t('admin-system.operations.database', {
              status: data.databaseAvailable
                ? t('admin-system.operations.databaseOk')
                : t('admin-system.operations.databaseDown'),
            })
          }}
        </p>
        <p v-if="data.storage" :role="data.storage.low ? 'alert' : undefined">
          {{ t('admin-system.operations.storage', { size: (data.storage.availableBytes / 1024 ** 3).toFixed(1) })
          }}{{ data.storage.low ? t('admin-system.operations.storageLow') : '' }}
        </p>
        <p v-else role="alert">{{ t('admin-system.operations.storageUnavailable') }}</p>
        <p>
          {{
            t('admin-system.operations.email', {
              status:
                !data.configured.email.enabled || !data.configured.email.configured
                  ? t('admin-system.operations.notConfigured')
                  : data.runtime?.control.externalPaused
                    ? t('admin-system.operations.paused')
                    : t('admin-system.operations.emailReady'),
            })
          }}
        </p>
        <p>
          {{
            t('admin-system.operations.backup', {
              status:
                !data.configured.backup.enabled || !data.configured.backup.configured
                  ? t('admin-system.operations.notConfigured')
                  : data.runtime?.control.backupPaused
                    ? t('admin-system.operations.paused')
                    : t('admin-system.operations.backupReady'),
            })
          }}
        </p>
        <p v-if="data.backupOverdue" role="alert">{{ t('admin-system.operations.backupOverdue') }}</p>
        <p>{{ t('admin-system.operations.channelNote') }}</p>
      </section>
      <template v-if="data.runtime">
        <p>
          {{
            t('admin-system.operations.lastRuns', {
              backup: date(data.runtime.lastVerifiedBackup),
              recovery: date(data.runtime.lastRecovery),
            })
          }}
        </p>
        <p v-if="data.runtime.failures" role="alert">
          {{ t('admin-system.operations.failures', { count: data.runtime.failures }, data.runtime.failures) }}
        </p>
        <p v-if="focusedError" role="alert">{{ focusedError }}</p>
        <section v-if="focused" :aria-label="t('admin-system.operations.focused')">
          <h2>{{ t('admin-system.operations.focused') }}</h2>
          <AdminOperationTask :task="focused" :disabled="!!working" @retry="retryTask" />
        </section>
        <h2>{{ t('admin-system.operations.tasks') }}</h2>
        <p v-if="!data.runtime.tasks.length">{{ t('admin-system.operations.noTasks') }}</p>
        <AdminOperationTask
          v-for="task in data.runtime.tasks"
          :key="task.id"
          :task="task"
          :disabled="!!working"
          @retry="retryTask"
        />
        <nav class="operations__pagination" :aria-label="t('admin-system.operations.pagination')">
          <NuxtLink v-if="page > 1" :to="{ query: { page: page - 1 } }">{{
            t('admin-system.operations.prev')
          }}</NuxtLink
          ><span>{{ page }} / {{ Math.max(1, Math.ceil(data.runtime.total / 20)) }}</span
          ><NuxtLink v-if="page * 20 < data.runtime.total" :to="{ query: { page: page + 1 } }">{{
            t('admin-system.operations.next')
          }}</NuxtLink>
        </nav>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { OperationStatus, OperationTask } from '~/features/notification/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.operations.title'), robots: 'noindex, nofollow' })
const route = useRoute(),
  api = useAdminApi(),
  auth = useCurrentUser()
const contentContext = useState<string>('page-content-context', () => '')
const page = computed(() => Math.max(1, Number.isSafeInteger(Number(route.query.page)) ? Number(route.query.page) : 1))
const { data, pending, error, refresh, captureOwnership } = useAdminReadResource(
  () => api<OperationStatus>('/admin/operations', { query: { page: page.value } }),
  () => t('admin-system.operations.loadFailed'),
)
const focused = ref<OperationTask | null>(null),
  focusedError = ref(''),
  working = ref(''),
  actionError = ref('')
let version = 0,
  alive = true
function date(value: string | null) {
  return (value && formatDateTime(value)) || t('admin-system.operations.noRecord')
}
async function focusTask() {
  const turn = ++version
  const owns = captureOwnership()
  focused.value = null
  focusedError.value = ''
  const id = typeof route.query.task === 'string' ? route.query.task : ''
  if (!id || !data.value) return
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    focusedError.value = t('admin-system.operations.invalidTask')
    return
  }
  try {
    const task = await api<OperationTask>(`/admin/operations/tasks/${id}`)
    if (alive && turn === version && owns()) focused.value = task
  } catch {
    if (alive && turn === version && owns()) focusedError.value = t('admin-system.operations.taskUnavailable')
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
  // acknowledgement 是后端校验的固定确认口令（operations.controller 的 IsIn），不随界面语言变化；确认框只翻译展示文案。
  const acknowledgement =
    task.state === 'uncertain'
      ? '已核对未送达并承担重复投递风险'
      : task.state === 'restored'
        ? '明确重新投递恢复前任务'
        : '重试失败任务'
  const confirmKind = task.state === 'uncertain' ? 'uncertain' : task.state === 'restored' ? 'restored' : 'failed'
  if (
    !window.confirm(
      t('admin-system.operations.retryConfirm', { action: t(`admin-system.operations.retryAction.${confirmKind}`) }),
    )
  )
    return
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
    if (owns()) actionError.value = t('admin-system.operations.retryFailed')
  } finally {
    if (owns()) working.value = ''
  }
}
</script>
<style scoped lang="scss">
.operations {
  min-width: 0;
  overflow-wrap: anywhere;
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
.operations__toolbar,
.operations__pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-block: 1rem;
  align-items: center;
}
.operations__toolbar a,
.operations__toolbar button,
.operations__pagination a {
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
}
a:not(.admin-btn) {
  color: var(--accent);
}
</style>
