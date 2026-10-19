<!-- @file index.vue @description 运营工作台：真实待办、六域草稿、快捷创作与最近编辑。 -->
<template>
  <section class="overview">
    <header>
      <div>
        <h1>{{ t('admin-system.overview.title') }}</h1>
        <p>{{ t('admin-system.overview.subtitle') }}</p>
      </div>
      <button type="button" :disabled="pending" @click="load">{{ t('admin-system.overview.refresh') }}</button>
    </header>
    <nav class="overview__quick" :aria-label="t('admin-system.overview.quickCreate')">
      <NuxtLink
        v-for="domain in overviewDomains"
        :key="domain.domain"
        :to="domain.domain === 'flash' ? '/admin/flashes?create=true' : domain.path + '/new'"
      >
        <Icon :name="domain.icon" />{{ t(`admin-system.overview.create.${domain.domain}`) }}
      </NuxtLink>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :compact="!!data"
      :title="error || t('admin-system.overview.loading')"
      @retry="load"
    />
    <p v-if="error && data" role="status">{{ t('admin-system.overview.stale') }}</p>
    <template v-if="data">
      <p class="overview__time">{{ t('admin-system.overview.readAt', { time: formatTime(data.generatedAt) }) }}</p>
      <section class="overview__panel" aria-labelledby="overview-tasks">
        <h2 id="overview-tasks">{{ t('admin-system.overview.tasksTitle') }}</h2>
        <p v-if="!data.counts" role="alert">
          {{ t('admin-system.overview.countsUnavailable')
          }}<button type="button" :disabled="pending" @click="load">
            {{ t('admin-system.overview.reloadCounts') }}
          </button>
        </p>
        <template v-else>
          <p v-if="overviewTasks.every((task) => data!.counts![task.key] === 0)">
            {{ t('admin-system.overview.noTasks') }}
          </p>
          <div class="overview__stats">
            <NuxtLink v-for="task in overviewTasks" :key="task.key" :to="task.to">
              <span>{{ t(task.labelKey) }}</span
              ><strong>{{ data.counts[task.key] }}</strong>
            </NuxtLink>
          </div>
        </template>
        <details>
          <summary>{{ t('admin-system.overview.countingRules') }}</summary>
          <p>{{ t('admin-system.overview.rulesUnanswered') }}</p>
          <p>{{ t('admin-system.overview.rulesPending') }}</p>
          <p>{{ t('admin-system.overview.rulesOther') }}</p>
        </details>
      </section>
      <section class="overview__panel" aria-labelledby="overview-drafts">
        <h2 id="overview-drafts">{{ t('admin-system.overview.draftsTitle') }}</h2>
        <p v-if="!data.counts" role="alert">{{ t('admin-system.overview.contentUnavailable') }}</p>
        <div v-else class="overview__stats">
          <article v-for="domain in overviewDomains" :key="domain.domain">
            <NuxtLink :to="domain.path"
              ><Icon :name="domain.icon" />{{
                t(
                  'admin-system.overview.domainTotal',
                  { label: t(domain.labelKey), count: data.counts[domain.total] },
                  data.counts[domain.total] ?? 0,
                )
              }}</NuxtLink
            >
            <NuxtLink :to="domain.path + '?status=draft'"
              ><i18n-t
                keypath="admin-system.overview.draftCount"
                :plural="data.counts[domain.drafts] ?? 0"
                scope="global"
                ><template #count
                  ><strong>{{ data.counts[domain.drafts] }}</strong></template
                ></i18n-t
              ></NuxtLink
            >
          </article>
        </div>
        <p>{{ t('admin-system.overview.draftsNote') }}</p>
        <NuxtLink to="/admin/posts?status=trash"
          >{{ t('admin-system.overview.trash')
          }}<span v-if="data.counts">
            ·
            {{ t('admin-system.overview.trashCount', { count: data.counts.trashed }, data.counts.trashed ?? 0) }}</span
          ></NuxtLink
        >
      </section>
      <section class="overview__panel" aria-labelledby="overview-recent">
        <h2 id="overview-recent">{{ t('admin-system.overview.recentTitle') }}</h2>
        <p v-if="data.recentContent === null" role="alert">
          {{ t('admin-system.overview.recentUnavailable')
          }}<button type="button" :disabled="pending" @click="load">
            {{ t('admin-system.overview.reloadRecent') }}
          </button>
        </p>
        <p v-else-if="!data.recentContent.length">{{ t('admin-system.overview.recentEmpty') }}</p>
        <ul v-else>
          <li v-for="item in data.recentContent" :key="item.domain + ':' + item.id">
            <NuxtLink :to="overviewEditorPath(item)">{{ item.title }}</NuxtLink>
            <span
              >{{ t(`admin-system.overview.domains.${item.domain}`) }} ·
              {{ t(`admin-system.overview.status.${item.status}`) }} · {{ formatTime(item.updatedAt) }}</span
            >
          </li>
        </ul>
      </section>
    </template>
    <AdminOperationsSummary />
  </section>
</template>
<script setup lang="ts">
import type { AdminOverview } from '~/features/admin/types'
import { overviewDomains, overviewTasks, overviewEditorPath } from '~/features/admin/overview'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.overview.title'), robots: 'noindex, nofollow' })
const api = useAdminApi()
const {
  data,
  pending,
  error,
  refresh: load,
} = useAdminReadResource(
  () => api<AdminOverview>('/admin/overview'),
  () => t('admin-system.overview.loadFailed'),
)
function formatTime(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped lang="scss">
.overview {
  min-width: 0;
}
header,
.overview__quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
header {
  justify-content: space-between;
  margin-bottom: 1rem;
}
h1 {
  font-size: 1.75rem;
  font-weight: 700;
}
h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
p,
.overview__time,
li span {
  color: var(--text-muted);
}
p {
  margin: 0.75rem 0;
}
a {
  color: var(--accent);
  overflow-wrap: anywhere;
}
button,
.overview__quick a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
}
button:disabled {
  opacity: 0.5;
}
.overview__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.overview__stats > a,
.overview__stats article {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
.overview__stats article a {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}
strong {
  font-size: 1.5rem;
  color: var(--text-main);
}
.overview__panel {
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-2);
}
details {
  margin-top: 1rem;
}
summary {
  cursor: var(--interaction-cursor, pointer);
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}
li:last-child {
  border: 0;
}
li span {
  font-size: 0.8125rem;
  flex-shrink: 0;
}
@media (max-width: 760px) {
  .overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }
}
@media (max-width: 390px) {
  .overview__stats {
    grid-template-columns: minmax(0, 1fr);
  }
  .overview__panel {
    padding: 0.75rem;
  }
}
</style>
