<!-- @file index.vue @description 友链管理入口，发布、推荐、排序与删除均使用服务端版本校验 -->
<template>
  <section class="admin-links">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-media.linkList.title') }}</h1>
        <p>{{ $t('admin-media.linkList.intro') }}</p>
      </div>
      <div class="admin-toolbar">
        <NuxtLink class="admin-btn admin-btn--primary" to="/admin/links/new">{{
          $t('admin-media.linkEditor.createTitle')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/admin/links/applications">{{
          $t('admin-media.linkApplications.title')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/admin/links/settings">{{
          $t('admin-media.linkSettings.title')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/links">{{ $t('admin-media.linkList.viewPublic') }}</NuxtLink>
      </div>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-card admin-toolbar admin-links__filters">
          <label
            >{{ $t('admin-media.linkList.search')
            }}<input
              :value="query.q ?? ''"
              :aria-label="$t('admin-media.linkList.searchLabel')"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >{{ $t('admin-media.linkList.status')
            }}<select
              :value="query.status"
              :aria-label="$t('admin-media.linkList.statusFilter')"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">{{ $t('admin-media.linkList.allStatuses') }}</option>
              <option v-for="status in linkStatuses" :key="status" :value="status">
                {{ linkStatusLabel(status, t) }}
              </option>
            </select></label
          ><label
            >{{ $t('admin-media.linkList.featured')
            }}<select
              :value="query.featured ?? ''"
              :aria-label="$t('admin-media.linkList.featuredFilter')"
              @change="filter({ featured: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">{{ $t('admin-media.linkList.all') }}</option>
              <option value="true">{{ $t('admin-media.linkList.featured') }}</option>
              <option value="false">{{ $t('admin-media.linkList.notFeatured') }}</option>
            </select></label
          ><button type="button" @click="filter({ q: undefined, status: undefined, featured: undefined })">
            {{ $t('admin-media.linkList.clearFilters') }}
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || $t('admin-media.linkList.loading')"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">{{ $t('admin-media.linkList.stale') }}</p>
        <p v-if="!pending && !error && data?.total === 0">{{ $t('admin-media.linkList.empty') }}</p>
        <ul class="admin-collection-list">
          <AdminCollectionItem
            v-for="link in data?.items ?? []"
            :key="link.id"
            :title="link.name"
            :meta="
              $t('admin-media.linkList.meta', {
                status: linkStatusLabel(link.status, t),
                featured: link.isFeatured
                  ? $t('admin-media.linkList.featured')
                  : $t('admin-media.linkList.notFeatured'),
                sort: link.sortOrder,
                revision: link.revision,
              })
            "
            :description="link.description"
          >
            <p class="admin-links__url">{{ link.url }}</p>
            <template #actions>
              <AdminCollectionActions
                :edit-to="`/admin/links/${link.id}`"
                :view-to="`/links?q=${encodeURIComponent(link.name)}`"
                :published="link.status === 'published'"
                :sort-order="link.sortOrder"
                :disabled="pending || busy.includes(link.id)"
                :labels="actionLabels"
                @update="mutate(link, $event)"
                @remove="mutate(link)"
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { isFeatured: !link.isFeatured })"
                >
                  {{ link.isFeatured ? $t('admin-media.linkList.unfeature') : $t('admin-media.linkList.feature') }}
                </button></AdminCollectionActions
              >
            </template>
          </AdminCollectionItem>
        </ul>
        <AdminCollectionPagination
          v-if="data"
          :page="query.page"
          :total="data.total"
          :disabled="pending"
          :label="$t('admin-media.linkList.pagination')"
          :prev-label="$t('admin-media.linkList.previous')"
          :next-label="$t('admin-media.linkList.next')"
          :summary="
            $t('admin-media.linkList.pageSummary', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / 12)),
              total: data.total,
            })
          "
          @go="filter({ page: $event })"
        />
      </template>
      <p v-else-if="!restoringPending">{{ $t('admin-media.linkList.loginRequired') }}</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
import { linkStatusLabel, linkStatuses } from '~/features/link/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.linkList.title'), robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminLinks()
const actionLabels = computed(() => ({
  edit: t('admin-media.linkEditor.editTitle'),
  view: t('admin-media.linkList.viewPublished'),
  publish: t('admin-media.linkList.publish'),
  withdraw: t('admin-media.linkList.withdraw'),
  raise: t('admin-media.linkList.raiseSort'),
  lower: t('admin-media.linkList.lowerSort'),
  remove: t('admin-media.linkList.delete'),
}))
</script>
<style scoped lang="scss">
.admin-links__filters {
  align-items: flex-end;
  padding: 0.75rem;
}
.admin-links {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.admin-links__url {
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .admin-links__filters > label,
  .admin-links__filters > button {
    flex: 1 1 100%;
  }
  .admin-links__filters input,
  .admin-links__filters select,
  .admin-links__filters button {
    width: 100%;
  }
}
</style>
