<!-- @file applications.vue @description 友链申请审核：公开开关、待审与已处理筛选，通过时建立友链草稿 -->
<template>
  <section class="admin-link-applications">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-media.linkApplications.title') }}</h1>
        <p>{{ $t('admin-media.linkApplications.intro') }}</p>
      </div>
    </header>
    <AdminBackLink to="/admin/links">{{ $t('admin-media.linkSettings.back') }}</AdminBackLink>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div v-if="settings" class="admin-card admin-toolbar admin-link-applications__switch">
          <p role="status">
            {{
              settings.applicationsEnabled
                ? $t('admin-media.linkApplications.enabled')
                : $t('admin-media.linkApplications.disabled')
            }}
          </p>
          <button
            class="admin-btn"
            :class="settings.applicationsEnabled ? 'admin-btn--ghost' : 'admin-btn--primary'"
            type="button"
            :disabled="toggling || pending"
            :aria-busy="toggling"
            @click="toggle"
          >
            {{
              settings.applicationsEnabled
                ? $t('admin-media.linkApplications.close')
                : $t('admin-media.linkApplications.open')
            }}
          </button>
        </div>
        <nav class="admin-toolbar" :aria-label="$t('admin-media.linkApplications.filterLabel')">
          <button
            v-for="status in linkApplicationFilters"
            :key="status"
            type="button"
            class="admin-btn"
            :class="query.status === status ? 'admin-btn--primary' : 'admin-btn--ghost'"
            :aria-pressed="query.status === status"
            @click="filter({ status: status === 'pending' ? undefined : status })"
          >
            {{ $t(`admin-media.linkApplications.filters.${status}`) }}
          </button>
          <span v-if="data">{{ $t('admin-media.linkApplications.pendingTotal', { count: data.pendingTotal }) }}</span>
        </nav>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || $t('admin-media.linkApplications.loading')"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="!pending && !error && data?.total === 0">
          {{ $t(`admin-media.linkApplications.empty.${query.status}`) }}
        </p>
        <ul class="admin-link-applications__list">
          <AdminLinkApplicationItem
            v-for="item in data?.items ?? []"
            :key="item.id"
            :item="item"
            :disabled="pending || busy.includes(item.id)"
            :focused="focus === item.id"
            :link-id="approvedLinks[item.id] ?? item.createdLinkId"
            @approve="decide($event, 'approve')"
            @reject="decide($event, 'reject')"
          />
        </ul>
        <nav
          v-if="data && (data.total > data.pageSize || query.page > 1)"
          class="admin-toolbar"
          :aria-label="$t('admin-media.linkApplications.pagination')"
        >
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            {{ $t('admin-media.linkList.previous') }}</button
          ><span>{{
            $t('admin-media.linkList.pageSummary', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / data.pageSize)),
              total: data.total,
            })
          }}</span
          ><button
            type="button"
            :disabled="pending || query.page * data.pageSize >= data.total"
            @click="filter({ page: query.page + 1 })"
          >
            {{ $t('admin-media.linkList.next') }}
          </button>
        </nav></template
      >
      <p v-else-if="!restoringPending">{{ $t('admin-media.linkList.loginRequired') }}</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
import { linkApplicationFilters } from '~/features/link/application'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.linkApplications.title'), robots: 'noindex, nofollow' })
const {
  data,
  settings,
  pending,
  toggling,
  error,
  notice,
  busy,
  approvedLinks,
  query,
  focus,
  filter,
  load,
  decide,
  toggle,
  isLoggedIn,
  restoringPending,
} = useAdminLinkApplications()
// 从通知进入时把对应申请滚动到可见位置。
watch(
  () => [focus.value, data.value] as const,
  ([id]) => {
    if (!id || !import.meta.client) return
    void nextTick(() => document.querySelector(`[data-application-id="${CSS.escape(id)}"]`)?.scrollIntoView())
  },
)
</script>
<style scoped lang="scss">
.admin-link-applications {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
}
.admin-link-applications__switch {
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
}
.admin-link-applications__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
p,
span {
  color: var(--text-muted);
}
</style>
