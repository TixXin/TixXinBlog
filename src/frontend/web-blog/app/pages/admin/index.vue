<!-- @file index.vue @description 运营工作台：统计卡片与近 30 天趋势、真实待办、最近编辑、六域草稿与快捷创作。 -->
<template>
  <section class="overview">
    <header class="overview__header">
      <div>
        <h1>{{ t('admin-system.overview.title') }}</h1>
        <p>
          <template v-if="greeting">{{ greeting }} · </template>{{ t('admin-system.overview.subtitle') }}
        </p>
      </div>
      <button type="button" class="admin-btn admin-btn--ghost" :disabled="pending" @click="load">
        <Icon name="lucide:refresh-cw" aria-hidden="true" />{{ t('admin-system.overview.refresh') }}
      </button>
    </header>
    <nav class="overview__quick" :aria-label="t('admin-system.overview.quickCreate')">
      <NuxtLink
        v-for="domain in overviewDomains"
        :key="domain.domain"
        :to="domain.domain === 'flash' ? '/admin/flashes?create=true' : domain.path + '/new'"
        :class="{ 'overview__quick-primary': domain.domain === 'post' }"
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
      <AdminOverviewMetrics :overview="data" />
      <div class="overview__columns">
        <AdminOverviewTasks :counts="data.counts" :pending="pending" @reload="load" />
        <AdminOverviewRecent :items="data.recentContent" :pending="pending" @reload="load" />
      </div>
      <AdminOverviewDrafts :counts="data.counts" />
      <p class="overview__time">{{ t('admin-system.overview.readAt', { time: formatTime(data.generatedAt) }) }}</p>
    </template>
    <AdminOperationsSummary />
  </section>
</template>
<script setup lang="ts">
import type { AdminOverview } from '~/features/admin/types'
import { overviewDomains } from '~/features/admin/overview'
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
// 问候语按访问者本地时间生成，挂载后再显示，避免与服务端渲染的时区不一致
const { ownerCard } = useSiteInfo()
const greeting = ref('')
onMounted(() => {
  const hour = new Date().getHours()
  const period = hour < 11 ? 'morning' : hour < 13 ? 'noon' : hour < 18 ? 'afternoon' : 'evening'
  greeting.value = t(`admin-system.overview.greeting.${period}`, { name: ownerCard.value.name })
})
function formatTime(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped lang="scss">
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--admin-gap);
  min-width: 0;
}
.overview__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  > div {
    flex: 1 1 auto;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }
  button {
    margin-left: auto;
    margin-right: 0;
    flex-shrink: 0;
    padding-right: 0;
  }
}
.overview__header button {
  :deep(.iconify),
  :deep(svg) {
    @media (prefers-reduced-motion: no-preference) {
      transition: transform 0.4s ease;
    }
  }
  &:hover:not(:disabled) {
    :deep(.iconify),
    :deep(svg) {
      @media (prefers-reduced-motion: no-preference) {
        transform: rotate(180deg);
      }
    }
  }
}
.overview__quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 2rem;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--admin-card-border);
    border-radius: 0.5rem;
    background: var(--admin-card-bg);
    color: var(--text-main);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      transform 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
      transform: none;

      :deep(.iconify),
      :deep(svg) {
        transition: none;
      }
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    :deep(.iconify),
    :deep(svg) {
      color: var(--text-soft);
      font-size: 0.9375rem;
      transition: color 0.15s ease;
    }
    &:hover {
      border-color: var(--border-hover);
      background: var(--surface-2);

      :deep(.iconify),
      :deep(svg) {
        color: var(--text-main);
      }
    }
  }
  .overview__quick-primary {
    border-color: transparent;
    background: var(--accent-action);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);

    :deep(.iconify),
    :deep(svg) {
      color: #fff;
    }
    &:hover {
      background: var(--accent);
      border-color: transparent;

      :deep(.iconify),
      :deep(svg) {
        color: #fff;
      }
    }
  }
}
.overview__columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--admin-gap);
}
.overview__time {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.75rem;
  text-align: right;
}
@media (max-width: 900px) {
  .overview__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
