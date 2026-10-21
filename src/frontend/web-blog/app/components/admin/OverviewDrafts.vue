<!-- @file OverviewDrafts.vue @description 管理概览的创作与草稿：六域总数与草稿数（链接到草稿筛选），以及文章回收站入口 -->
<template>
  <section class="admin-card" aria-labelledby="overview-drafts">
    <h2 id="overview-drafts">{{ t('admin-system.overview.draftsTitle') }}</h2>
    <p v-if="!counts" role="alert">{{ t('admin-system.overview.contentUnavailable') }}</p>
    <div v-else class="overview__stats overview__domains">
      <article v-for="domain in overviewDomains" :key="domain.domain">
        <NuxtLink :to="domain.path"
          ><Icon :name="domain.icon" />{{
            t(
              'admin-system.overview.domainTotal',
              { label: t(domain.labelKey), count: counts[domain.total] },
              counts[domain.total] ?? 0,
            )
          }}</NuxtLink
        >
        <NuxtLink :to="domain.path + '?status=draft'"
          ><i18n-t keypath="admin-system.overview.draftCount" :plural="counts[domain.drafts] ?? 0" scope="global"
            ><template #count
              ><strong>{{ counts[domain.drafts] }}</strong></template
            ></i18n-t
          ></NuxtLink
        >
      </article>
    </div>
    <footer class="overview__drafts-footer">
      <p>{{ t('admin-system.overview.draftsNote') }}</p>
      <NuxtLink to="/admin/posts?status=trash"
        ><Icon name="lucide:trash-2" aria-hidden="true" />{{ t('admin-system.overview.trash')
        }}<span v-if="counts">
          ·
          {{ t('admin-system.overview.trashCount', { count: counts.trashed }, counts.trashed ?? 0) }}</span
        ></NuxtLink
      >
    </footer>
  </section>
</template>

<script setup lang="ts">
import { overviewDomains } from '~/features/admin/overview'

defineProps<{ counts: Record<string, number> | null }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
// 六域：图标 + 总数，草稿数链接到筛选落点
.overview__domains {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  article {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
    padding: 0.75rem 0.875rem;
    border: 1px solid var(--admin-card-border);
    border-radius: 0.5rem;
    background: var(--surface-2);
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    &:hover {
      border-color: var(--border-hover);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
    }
  }
  a {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    color: var(--text-main);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    :deep(.iconify),
    :deep(svg) {
      color: var(--text-soft);
    }
    &:hover {
      color: var(--accent-action);

      :deep(.iconify),
      :deep(svg) {
        color: var(--accent-action);
      }
    }
  }
  a + a {
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  strong {
    color: var(--text-main);
    font-size: 1.125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
.overview__drafts-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-top: 0.75rem;

  p {
    flex: 1 1 20rem;
    margin: 0;
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-muted);
    font-size: 0.75rem;
    text-decoration: none;
    transition: color 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    &:hover {
      color: var(--danger-text);
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
}
@media (max-width: 760px) {
  .overview__domains {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 390px) {
  .overview__domains {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
