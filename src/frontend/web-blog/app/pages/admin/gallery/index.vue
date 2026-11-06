<!-- @file index.vue @description 图库管理入口，公开状态与媒体文件保留范围清晰分离 -->
<template>
  <section class="admin-gallery">
    <AdminPageHeader :title="$t('admin-media.galleryList.title')" :intro="$t('admin-media.galleryList.intro')">
      <template #actions>
        <NuxtLink class="admin-btn admin-btn--primary" to="/admin/gallery/new">{{
          $t('admin-media.galleryList.create')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/admin/gallery/settings">{{
          $t('admin-media.galleryList.gearSettings')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/gallery">{{
          $t('admin-media.galleryList.viewPublic')
        }}</NuxtLink>
      </template>
    </AdminPageHeader>
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
        <AdminListSkeleton
          v-if="pending && !error"
          :label="$t('admin-media.galleryList.loading')"
          :rows="!!data ? 0 : 4"
          variant="cards"
        />
        <CommonRequestFeedback v-if="error" :compact="!!data" :pending="pending" :title="error" @retry="load" />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">{{ $t('admin-media.galleryList.stale') }}</p>
        <AdminEmptyState v-if="!pending && !error && data?.total === 0" :title="$t('admin-media.galleryList.empty')" />
        <ul class="admin-collection-list">
          <AdminCollectionItem
            v-for="photo in data?.items ?? []"
            :key="photo.id"
            :title="photo.title"
            :meta="
              $t('admin-media.galleryList.meta', {
                status: $t(`admin-media.galleryList.statusLabel.${photo.status}`),
                category: photo.category || $t('admin-media.galleryList.uncategorized'),
                sort: photo.sortOrder,
                revision: photo.revision,
              })
            "
            :description="photo.description"
          >
            <template #media>
              <CommonImageFrame
                :src="photo.src"
                :alt="photo.title"
                :width="photo.width"
                :height="photo.height"
                fit="contain"
              />
            </template>
            <template #actions>
              <AdminCollectionActions
                :edit-to="`/admin/gallery/${photo.id}`"
                :view-to="`/gallery?photo=${photo.id}`"
                :published="photo.status === 'published'"
                :sort-order="photo.sortOrder"
                :disabled="pending || busy.includes(photo.id)"
                :labels="actionLabels"
                @update="mutate(photo, $event)"
                @remove="mutate(photo)"
              />
            </template>
          </AdminCollectionItem>
        </ul>
        <AdminCollectionPagination
          v-if="data"
          :page="query.page"
          :total="data.total"
          :disabled="pending"
          :label="$t('admin-media.galleryList.pagination')"
          :prev-label="$t('admin-media.galleryList.previous')"
          :next-label="$t('admin-media.galleryList.next')"
          :summary="
            $t('admin-media.galleryList.pageSummary', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / 12)),
              total: data.total,
            })
          "
          @go="filter({ page: $event })"
        />
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
const actionLabels = computed(() => ({
  edit: t('admin-media.galleryList.edit'),
  view: t('admin-media.galleryList.viewPublished'),
  publish: t('admin-media.galleryList.publish'),
  withdraw: t('admin-media.galleryList.withdraw'),
  raise: t('admin-media.galleryList.raiseSort'),
  lower: t('admin-media.galleryList.lowerSort'),
  remove: t('admin-media.galleryList.delete'),
}))
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
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
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
}
</style>
