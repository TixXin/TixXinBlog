<!--
  @file TrafficRecentVisits.vue
  @description 近期访问明细：默认关闭，开启后记录每次浏览的打码 IP、地区、设备、页面与来源，只保留 7 天，
               关闭时服务端立即清空；博主本人的访问不记录。开关与列表同处一张卡片，开启前不读取明细。
-->
<template>
  <section class="traffic-visits">
    <div class="traffic-visits__head">
      <h2>{{ t('admin-system.traffic.visits.title') }}</h2>
      <label class="traffic-visits__toggle">
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="settingsPending || saving"
          data-testid="recent-visits-toggle"
          @change="toggle($event.target as HTMLInputElement)"
        />
        {{ t('admin-system.traffic.visits.enable') }}
      </label>
    </div>
    <p class="traffic-visits__hint">{{ t('admin-system.traffic.visits.hint') }}</p>
    <p v-if="error" role="alert" class="traffic-visits__error">{{ error }}</p>
    <template v-if="enabled">
      <p v-if="!page && pending" role="status" class="traffic-visits__hint">{{ t('admin-system.traffic.loading') }}</p>
      <p v-else-if="page && !page.items.length" class="traffic-visits__hint">
        {{ t('admin-system.traffic.visits.empty') }}
      </p>
      <div v-else-if="page" class="traffic-visits__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ t('admin-system.traffic.visits.time') }}</th>
              <th scope="col">{{ t('admin-system.traffic.visits.ip') }}</th>
              <th scope="col">{{ t('admin-system.traffic.visits.place') }}</th>
              <th scope="col">{{ t('admin-system.traffic.visits.device') }}</th>
              <th scope="col">{{ t('admin-system.traffic.visits.page') }}</th>
              <th scope="col">{{ t('admin-system.traffic.visits.referrer') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(visit, index) in page.items" :key="`${visit.visitedAt}-${index}`">
              <td>
                <time :datetime="visit.visitedAt">{{ formatTime(visit.visitedAt) }}</time>
              </td>
              <td class="traffic-visits__mono">{{ visit.maskedIp || '—' }}</td>
              <td>{{ visitPlace(visit, locale) || t('admin-system.traffic.unknownPlace') }}</td>
              <td>{{ deviceLabel(visit.device) }}</td>
              <td class="traffic-visits__mono">{{ visit.path }}</td>
              <td>{{ referrerLabel(visit.referrer) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminModerationPagination
        v-if="page && (page.total > page.pageSize || page.page > 1)"
        :page="page.page"
        :total="page.total"
        :page-size="page.pageSize"
        :disabled="pending"
        :aria-label="t('admin-system.traffic.visits.pagination')"
        @prev="go(page.page - 1)"
        @next="go(page.page + 1)"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { visitPlace, type RecentVisitsPage } from '~/features/presence/traffic'

const { t, locale } = useI18n()
const adminApi = useAdminApi()
const enabled = ref(false),
  settingsPending = ref(true),
  saving = ref(false),
  error = ref('')
const pageNumber = ref(1)
const resource = useAdminReadResource(
  async () =>
    enabled.value ? adminApi<RecentVisitsPage>('/admin/presence/visits', { query: { page: pageNumber.value } }) : null,
  () => t('admin-system.traffic.visits.loadFailed'),
)
const page = resource.data,
  pending = resource.pending

onMounted(async () => {
  try {
    enabled.value = (await adminApi<{ recentVisits: boolean }>('/admin/presence')).recentVisits
    if (enabled.value) await resource.refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin-system.traffic.visits.loadFailed')
  } finally {
    settingsPending.value = false
  }
})

async function toggle(input: HTMLInputElement) {
  const next = input.checked
  // 关闭会清空已记录的明细，先确认；取消时把复选框恢复为勾选
  if (!next && !window.confirm(t('admin-system.traffic.visits.disableConfirm'))) {
    input.checked = true
    return
  }
  saving.value = true
  try {
    const saved = await adminApi<{ recentVisits: boolean }>('/admin/presence', {
      method: 'PATCH',
      body: { recentVisits: next },
    })
    enabled.value = saved.recentVisits
    error.value = ''
    pageNumber.value = 1
    await resource.refresh()
  } catch (cause) {
    input.checked = enabled.value
    error.value = cause instanceof Error ? cause.message : t('admin-system.traffic.visits.saveFailed')
  } finally {
    saving.value = false
  }
}

async function go(target: number) {
  pageNumber.value = target
  await resource.refresh()
}

/** 外部刷新（页头的刷新按钮）时一并重读 */
defineExpose({ refresh: () => (enabled.value ? resource.refresh() : undefined) })

const timeFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium' }))
const formatTime = (value: string) => timeFormat.value.format(new Date(value))
function deviceLabel(key: string) {
  const [device = 'desktop', browser = 'other'] = key.split('/')
  return `${t(`admin-system.traffic.deviceNames.${device}`)} · ${t(`admin-system.traffic.browserNames.${browser}`)}`
}
function referrerLabel(referrer: string | null) {
  if (referrer === null) return t('admin-system.traffic.visits.internal')
  return referrer || t('admin-system.traffic.direct')
}
</script>

<style scoped lang="scss">
.traffic-visits {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-1);

  h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }
}

.traffic-visits__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.traffic-visits__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  cursor: pointer;
}

.traffic-visits__hint,
.traffic-visits__error {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.traffic-visits__error {
  color: var(--danger, #dc2626);
}

.traffic-visits__scroll {
  margin-top: 0.75rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

th,
td {
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--text-muted);
  font-weight: 500;
}

.traffic-visits__mono {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.75rem;
}
</style>
