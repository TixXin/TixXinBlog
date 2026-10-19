<!-- @file gallery.vue @description 真实图库，公开列表、分类统计和灯箱共享 URL 状态 -->
<template>
  <CommonPageFrame class="main-inner" header-key="gallery">
    <template #header>
      <CommonPageHeader
        :title="$t('misc.gallery.page.title')"
        :subtitle="$t('misc.gallery.page.subtitle')"
        icon="lucide:image"
      >
        <template #action
          ><CommonSearchBox
            v-model="keyword"
            :placeholder="$t('misc.gallery.page.searchPlaceholder')"
            :label="$t('misc.gallery.page.searchLabel')"
        /></template>
      </CommonPageHeader>
    </template>
    <template #default>
      <CommonCustomScrollbar
        class="gallery-body"
        tabindex="-1"
        viewport-class="gallery-viewport"
        :show-back-to-top="false"
        :preserved-query-keys="['photo']"
        primary
      >
        <GalleryFilter
          :model-value="query.category"
          :categories="categories"
          :disabled="!ready"
          @update:model-value="filterCategory"
        />
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="photos.length > 0"
          :title="error?.message || $t('misc.gallery.page.loading')"
          @retry="refresh()"
        />
        <p v-if="stale" role="status" class="gallery-result">{{ $t('misc.gallery.page.stale') }}</p>
        <p v-else-if="total" class="gallery-result" role="status">
          {{ $t('misc.gallery.page.summary', { count: total, page: query.page }, total) }}
        </p>
        <CommonStateBlock
          v-if="!pending && !error && !photos.length"
          icon="lucide:images"
          :title="filtered ? $t('misc.gallery.empty.filteredTitle') : $t('misc.gallery.empty.title')"
          :description="emptyDescription"
          :action-label="filtered ? $t('misc.gallery.page.clearFilters') : undefined"
          @action="clearFilters"
        />
        <GalleryGrid v-else :photos="photos" :ready="ready" @select="open" />
        <nav
          v-if="total !== null && (total > 12 || query.page > 1)"
          class="gallery-pagination"
          :aria-label="$t('misc.gallery.page.pagination')"
        >
          <button
            type="button"
            :disabled="!ready || query.page <= 1 || pending"
            @click="changeQuery({ page: query.page - 1 })"
          >
            {{ $t('misc.shared.prevPage') }}
          </button>
          <span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span>
          <button
            type="button"
            :disabled="!ready || query.page * 12 >= total || pending"
            @click="changeQuery({ page: query.page + 1 })"
          >
            {{ $t('misc.shared.nextPage') }}
          </button>
        </nav>
        <details class="gallery-mobile-info" :class="`gallery-mobile-info--${sidebarPlacement}`">
          <summary>{{ $t('misc.gallery.page.compactInfo') }}</summary>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataFeedbackTitle"
            :description="metadataFeedbackDescription"
            @retry="refreshMetadata()"
          /><GalleryStats v-if="metadata" :stats="stats" /><GalleryGearCard v-if="metadata" :gear="metadata.gear" />
        </details>
      </CommonCustomScrollbar>
    </template>
    <template #overlays>
      <GalleryLightBox
        :photo="selectedPhoto"
        :visible="selectedId !== null"
        :pending="detailPending || moving"
        :error="detailError"
        :can-previous="canPrevious"
        :can-next="canNext"
        @close="close"
        @previous="move(-1)"
        @next="move(1)"
        @retry="readSelection"
      />
      <Teleport v-if="activeTheme.capabilities.rightSidebar" to="#right-sidebar-target"
        ><SidebarRightSidebar>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataFeedbackTitle"
            :description="metadataFeedbackDescription"
            @retry="refreshMetadata()"
          />
          <GalleryStats v-if="metadata" :stats="stats" /><GalleryGearCard
            v-if="metadata"
            :gear="metadata.gear"
          /> </SidebarRightSidebar
      ></Teleport>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
const { t } = useI18n()
const route = useRoute(),
  router = useRouter()
const { currentThemeId, activeTheme } = useLayoutTheme()
const sidebarPlacement = computed(() =>
  activeTheme.value.capabilities.rightSidebar ? currentThemeId.value : 'standalone',
)
const {
  query,
  ready,
  photos,
  total,
  selectedId,
  selectedPhoto,
  pending,
  error,
  refresh,
  stale,
  metadata,
  metadataPending,
  metadataError,
  refreshMetadata,
  detailPending,
  detailError,
  readSelection,
  moving,
  move,
  changeQuery,
  canPrevious,
  canNext,
  open,
  close,
} = await useGallery()
// 失败用稳定标题；具体原因放在说明里，有旧统计时同时说明仍在显示。
const metadataFeedbackTitle = computed(() =>
  metadataError.value ? t('misc.gallery.metadata.unavailable') : t('misc.gallery.metadata.loading'),
)
const metadataFeedbackDescription = computed(() => {
  if (!metadataError.value) return undefined
  const message = metadataError.value.message
  return metadata.value ? t('misc.gallery.metadata.staleDescription', { message }) : message
})
usePageSeo({
  title: () => t('misc.gallery.page.title'),
  description: () => t('misc.gallery.page.seoDescription'),
  type: 'website',
  image: () => photos.value[0]?.srcLarge,
  imageAlt: () => photos.value[0]?.title,
})
const keyword = computed({
  get: () => (!ready.value ? (query.value.q ?? '') : typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => {
    void router.replace({
      path: '/gallery',
      query: { ...route.query, q: q || undefined, page: undefined, photo: undefined },
    })
  },
})
const filtered = computed(() => !!query.value.q || query.value.category !== undefined)
// 只按分类筛选时没有关键词可换，提示切换分类；有关键词时提示搜索覆盖的字段
const emptyDescription = computed(() =>
  query.value.q
    ? t('misc.gallery.empty.keywordDescription')
    : filtered.value
      ? t('misc.gallery.empty.categoryDescription')
      : t('misc.gallery.empty.description'),
)
const categories = computed(() => [
  { label: t('misc.gallery.filter.all'), value: undefined, count: metadata.value?.stats.photos },
  ...(metadata.value?.categories ?? []),
])
const stats = computed(() =>
  metadata.value
    ? [
        { label: t('misc.gallery.stats.photos'), value: String(metadata.value.stats.photos) },
        { label: t('misc.gallery.stats.locations'), value: String(metadata.value.stats.locations) },
        { label: t('misc.gallery.stats.categories'), value: String(metadata.value.stats.categories) },
      ]
    : [],
)
function filterCategory(value: string | undefined) {
  void changeQuery({ category: value })
}
function clearFilters() {
  void changeQuery({ q: undefined, category: undefined })
}
</script>
<style lang="scss" scoped>
.gallery-result {
  margin-block: 0.75rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.gallery-body {
  flex: 1;
  padding: 0;
}
:deep(.gallery-viewport) {
  padding: 0 2rem 2rem;
}
.gallery-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-block: 1rem;
}
.gallery-pagination button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
.gallery-pagination button:disabled {
  opacity: 0.5;
}
.gallery-mobile-info {
  display: block;
}
.gallery-mobile-info summary {
  padding: 0.75rem 0;
  cursor: var(--interaction-cursor, pointer);
}
// 结构在 SSR 与水合间保持一致；紧凑入口只在当前主题的固定侧栏不可见时展示。
@media (min-width: 1440px) {
  .gallery-mobile-info--nexus {
    display: none;
  }
}
@media (min-width: 1280px) {
  .gallery-mobile-info--aurora {
    display: none;
  }
}
@media (max-width: 640px) {
  :deep(.gallery-viewport) {
    padding: 0 1rem 1rem;
  }
}
</style>
