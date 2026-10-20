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
    gap: 0.5rem;
    min-width: 0;
    padding: 0.875rem 1rem;
    border: 1px solid var(--admin-card-border);
    border-radius: 0.75rem;
    background: var(--surface-2);
  }
  a {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    color: var(--text-main);
    font-size: 0.875rem;
    text-decoration: none;

    &:hover {
      color: var(--accent-text);
    }
  }
  a + a {
    color: var(--text-soft);
    font-size: 0.8125rem;
  }
  strong {
    color: var(--text-main);
    font-size: 1.25rem;
    font-weight: 600;
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
    font-size: 0.75rem;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-muted);
    font-size: 0.8125rem;
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
