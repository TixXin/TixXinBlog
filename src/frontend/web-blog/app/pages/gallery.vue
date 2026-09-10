<!-- @file gallery.vue @description 真实图库，公开列表、分类统计和灯箱共享 URL 状态 -->
<template>
  <CommonPageFrame class="main-inner" header-key="gallery">
    <template #header>
      <CommonPageHeader title="画廊" subtitle="用镜头记录生活的美好瞬间" icon="lucide:image">
        <template #action
          ><CommonSearchBox v-model="keyword" placeholder="搜索照片、地点..." label="搜索画廊照片"
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
          :title="error?.message || '正在读取照片'"
          @retry="refresh()"
        />
        <p v-if="stale" role="status" class="gallery-result">正在显示上一次成功读取的照片，当前筛选尚未完成。</p>
        <p v-else-if="total !== null" class="gallery-result" role="status">
          共 {{ total }} 张照片 · 第 {{ query.page }} 页
        </p>
        <CommonStateBlock
          v-if="!pending && !error && !photos.length"
          icon="lucide:images"
          :title="filtered ? '没有找到照片' : '尚无公开作品'"
          :description="filtered ? '试试其他标题、描述或地点。' : '照片公开后会展示在这里。'"
          :action-label="filtered ? '清除筛选' : undefined"
          @action="clearFilters"
        />
        <GalleryGrid v-else :photos="photos" :ready="ready" @select="open" />
        <nav v-if="total !== null && (total > 12 || query.page > 1)" class="gallery-pagination" aria-label="图库分页">
          <button
            type="button"
            :disabled="!ready || query.page <= 1 || pending"
            @click="changeQuery({ page: query.page - 1 })"
          >
            上一页
          </button>
          <span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span>
          <button
            type="button"
            :disabled="!ready || query.page * 12 >= total || pending"
            @click="changeQuery({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
        <details class="gallery-mobile-info" :class="`gallery-mobile-info--${sidebarPlacement}`">
          <summary>图库统计与器材</summary>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataError?.message || '正在读取图库统计'"
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
      <ClientOnly
        ><Teleport v-if="activeTheme.capabilities.rightSidebar" to="#right-sidebar-target"
          ><SidebarRightSidebar>
            <CommonRequestFeedback
              v-if="metadataPending || metadataError"
              :pending="metadataPending"
              :compact="!!metadata"
              :title="metadataError?.message || '正在读取图库统计'"
              @retry="refreshMetadata()"
            />
            <GalleryStats v-if="metadata" :stats="stats" /><GalleryGearCard
              v-if="metadata"
              :gear="metadata.gear"
            /> </SidebarRightSidebar></Teleport
      ></ClientOnly>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
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
useSeoMeta({
  title: '画廊',
  description: '用镜头记录生活的美好瞬间，浏览摄影作品与拍摄故事',
  ogType: 'website',
  ogImage: () => photos.value[0]?.srcLarge,
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
const categories = computed(() => [
  { label: '全部', value: undefined, count: metadata.value?.stats.photos },
  ...(metadata.value?.categories ?? []),
])
const stats = computed(() =>
  metadata.value
    ? [
        { label: '公开照片', value: String(metadata.value.stats.photos) },
        { label: '拍摄地点', value: String(metadata.value.stats.locations) },
        { label: '分类', value: String(metadata.value.stats.categories) },
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
  cursor: pointer;
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
