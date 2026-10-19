<!-- @file index.vue @description 友链管理入口，发布、推荐、排序与删除均使用服务端版本校验 -->
<template>
  <section class="admin-links">
    <header>
      <div>
        <h1>{{ $t('admin-media.linkList.title') }}</h1>
        <p>{{ $t('admin-media.linkList.intro') }}</p>
      </div>
      <NuxtLink to="/admin/links/new">{{ $t('admin-media.linkEditor.createTitle') }}</NuxtLink
      ><NuxtLink to="/admin/links/settings">{{ $t('admin-media.linkSettings.title') }}</NuxtLink
      ><NuxtLink to="/links">{{ $t('admin-media.linkList.viewPublic') }}</NuxtLink>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-links__filters">
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
        <ul class="admin-links__list">
          <li v-for="link in data?.items ?? []" :key="link.id">
            <div>
              <h2>{{ link.name }}</h2>
              <p>
                {{
                  $t('admin-media.linkList.meta', {
                    status: linkStatusLabel(link.status, t),
                    featured: link.isFeatured
                      ? $t('admin-media.linkList.featured')
                      : $t('admin-media.linkList.notFeatured'),
                    sort: link.sortOrder,
                    revision: link.revision,
                  })
                }}
              </p>
              <p>{{ link.description }}</p>
              <p class="admin-links__url">{{ link.url }}</p>
              <div class="admin-links__actions">
                <NuxtLink :to="`/admin/links/${link.id}`">{{ $t('admin-media.linkEditor.editTitle') }}</NuxtLink
                ><NuxtLink v-if="link.status === 'published'" :to="`/links?q=${encodeURIComponent(link.name)}`">{{
                  $t('admin-media.linkList.viewPublished')
                }}</NuxtLink
                ><button
                  v-if="link.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { status: 'published' })"
                >
                  {{ $t('admin-media.linkList.publish') }}</button
                ><button
                  v-if="link.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { status: 'withdrawn' })"
                >
                  {{ $t('admin-media.linkList.withdraw') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { isFeatured: !link.isFeatured })"
                >
                  {{
                    link.isFeatured ? $t('admin-media.linkList.unfeature') : $t('admin-media.linkList.feature')
                  }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id) || link.sortOrder >= 1000000"
                  @click="mutate(link, { sortOrder: link.sortOrder + 1 })"
                >
                  {{ $t('admin-media.linkList.raiseSort') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id) || link.sortOrder <= -1000000"
                  @click="mutate(link, { sortOrder: link.sortOrder - 1 })"
                >
                  {{ $t('admin-media.linkList.lowerSort') }}</button
                ><button type="button" :disabled="pending || busy.includes(link.id)" @click="mutate(link)">
                  {{ $t('admin-media.linkList.delete') }}
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav
          v-if="data && (data.total > 12 || query.page > 1)"
          class="admin-links__actions"
          :aria-label="$t('admin-media.linkList.pagination')"
        >
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            {{ $t('admin-media.linkList.previous') }}</button
          ><span>{{
            $t('admin-media.linkList.pageSummary', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / 12)),
              total: data.total,
            })
          }}</span
          ><button
            type="button"
            :disabled="pending || query.page * 12 >= data.total"
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
import { linkStatusLabel, linkStatuses } from '~/features/link/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.linkList.title'), robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminLinks()
</script>
<style scoped lang="scss">
.admin-links {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
}
header,
.admin-links__filters,
.admin-links__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
header > div {
  margin-right: auto;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
a {
  color: var(--accent);
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
input,
select,
button {
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
button:disabled {
  opacity: 0.5;
}
.admin-links__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.admin-links__list li {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
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
