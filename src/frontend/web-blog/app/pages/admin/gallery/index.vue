<!-- @file index.vue @description 图库管理入口，公开状态与媒体文件保留范围清晰分离 -->
<template>
  <section class="admin-gallery">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-media.galleryList.title') }}</h1>
        <p>{{ $t('admin-media.galleryList.intro') }}</p>
      </div>
      <div class="admin-toolbar">
        <NuxtLink class="admin-btn admin-btn--primary" to="/admin/gallery/new">{{
          $t('admin-media.galleryList.create')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/admin/gallery/settings">{{
          $t('admin-media.galleryList.gearSettings')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/gallery">{{
          $t('admin-media.galleryList.viewPublic')
        }}</NuxtLink>
      </div>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn">
        <div class="admin-card admin-toolbar admin-gallery__filters">
          <label
            >{{ $t('admin-media.galleryList.search')
            }}<input
              :value="query.q ?? ''"
              :aria-label="$t('admin-media.galleryList.search')"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >{{ $t('admin-media.galleryList.status')
            }}<select
              :value="query.status"
              :aria-label="$t('admin-media.galleryList.statusFilter')"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">{{ $t('admin-media.galleryList.allStatuses') }}</option>
              <option value="draft">{{ $t('admin-media.galleryList.statusLabel.draft') }}</option>
              <option value="published">{{ $t('admin-media.galleryList.statusLabel.published') }}</option>
              <option value="withdrawn">{{ $t('admin-media.galleryList.statusLabel.withdrawn') }}</option>
            </select></label
          ><label
            >{{ $t('admin-media.galleryList.category')
            }}<input
              :value="query.category ?? ''"
              :aria-label="$t('admin-media.galleryList.categoryFilter')"
              maxlength="40"
              @change="filter({ category: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><button type="button" @click="filter({ category: '' })">
            {{ $t('admin-media.galleryList.uncategorizedOnly') }}</button
          ><button type="button" @click="filter({ q: undefined, category: undefined, status: undefined })">
            {{ $t('admin-media.galleryList.clearFilters') }}
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || $t('admin-media.galleryList.loading')"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">{{ $t('admin-media.galleryList.stale') }}</p>
        <p v-if="!pending && !error && data?.total === 0">{{ $t('admin-media.galleryList.empty') }}</p>
        <ul class="admin-gallery__list">
          <li v-for="photo in data?.items ?? []" :key="photo.id">
            <CommonImageFrame
              :src="photo.src"
              :alt="photo.title"
              :width="photo.width"
              :height="photo.height"
              fit="contain"
            />
            <div>
              <h2>{{ photo.title }}</h2>
              <p>
                {{
                  $t('admin-media.galleryList.meta', {
                    status: $t(`admin-media.galleryList.statusLabel.${photo.status}`),
                    category: photo.category || $t('admin-media.galleryList.uncategorized'),
                    sort: photo.sortOrder,
                    revision: photo.revision,
                  })
                }}
              </p>
              <p>{{ photo.description }}</p>
              <div class="admin-gallery__actions">
                <NuxtLink :to="`/admin/gallery/${photo.id}`">{{ $t('admin-media.galleryList.edit') }}</NuxtLink
                ><NuxtLink v-if="photo.status === 'published'" :to="`/gallery?photo=${photo.id}`">{{
                  $t('admin-media.galleryList.viewPublished')
                }}</NuxtLink
                ><button
                  v-if="photo.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(photo.id)"
                  @click="mutate(photo, { status: 'published' })"
                >
                  {{ $t('admin-media.galleryList.publish') }}</button
                ><button
                  v-if="photo.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(photo.id)"
                  @click="mutate(photo, { status: 'withdrawn' })"
                >
                  {{ $t('admin-media.galleryList.withdraw') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(photo.id) || photo.sortOrder >= 1000000"
                  @click="mutate(photo, { sortOrder: photo.sortOrder + 1 })"
                >
                  {{ $t('admin-media.galleryList.raiseSort') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(photo.id) || photo.sortOrder <= -1000000"
                  @click="mutate(photo, { sortOrder: photo.sortOrder - 1 })"
                >
                  {{ $t('admin-media.galleryList.lowerSort') }}</button
                ><button
                  class="admin-btn admin-btn--danger"
                  type="button"
                  :disabled="pending || busy.includes(photo.id)"
                  @click="mutate(photo)"
                >
                  {{ $t('admin-media.galleryList.delete') }}
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav
          v-if="data && (data.total > 12 || query.page > 1)"
          class="admin-gallery__actions"
          :aria-label="$t('admin-media.galleryList.pagination')"
        >
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            {{ $t('admin-media.galleryList.previous') }}</button
          ><span>{{
            $t('admin-media.galleryList.pageSummary', {
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
            {{ $t('admin-media.galleryList.next') }}
          </button>
        </nav>
      </template>
      <p v-else-if="!restoringPending">{{ $t('admin-media.galleryList.loginRequired') }}</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.galleryList.title'), robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminGallery()
</script>
<style scoped lang="scss">
.admin-gallery__filters {
  align-items: flex-end;
  padding: 0.75rem;
}
.admin-gallery {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
}
.admin-gallery__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
a:not(.admin-btn) {
  color: var(--accent);
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.admin-gallery__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.admin-gallery__list li {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
}
.admin-gallery__list p {
  white-space: pre-wrap;
}
@media (max-width: 600px) {
  .admin-gallery__filters > label,
  .admin-gallery__filters > button {
    flex: 1 1 100%;
  }
  .admin-gallery__filters input,
  .admin-gallery__filters select,
  .admin-gallery__filters button {
    width: 100%;
  }
  .admin-gallery__list li {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-gallery__list :deep(.image-frame) {
    max-width: 260px;
  }
}
</style>
