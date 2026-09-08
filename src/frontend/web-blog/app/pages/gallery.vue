<!--
  @file gallery.vue
  @description 画廊页面，瀑布流照片、分类筛选与灯箱预览
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
    <CommonPageHeader title="画廊" subtitle="演示照片集，可按标题、描述和地点搜索" icon="lucide:image">
      <template #action>
        <CommonSearchBox v-model="keyword" placeholder="搜索照片、地点..." label="搜索画廊照片" />
      </template>
    </CommonPageHeader>
    <CommonCustomScrollbar class="gallery-body" viewport-class="gallery-viewport" :show-back-to-top="false" primary>
      <GalleryFilter v-model="activeFilter" :categories="categories" />
      <p class="gallery-result" role="status">显示 {{ filteredPhotos.length }} / {{ photos.length }} 张演示照片</p>
      <CommonStateBlock
        v-if="filteredPhotos.length === 0"
        icon="lucide:search-x"
        title="没有找到照片"
        description="试试其他标题、描述或地点，也可以清除当前筛选。"
        action-label="清除筛选"
        @action="clearFilters"
      />
      <GalleryGrid v-else :photos="filteredPhotos" @select="openLightBox" />
    </CommonCustomScrollbar>
    <GalleryLightBox :photo="selectedPhoto" :visible="lightBoxVisible" @close="closeLightBox" />
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <GalleryStats :stats="galleryStats" />
          <GalleryGearCard :gear="gearList" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'
import { mockGalleryCategories, mockGearList, mockPhotos } from '~/features/gallery/mock'

useSeoMeta({
  title: '画廊',
  description: '用镜头记录生活的美好瞬间，支持分类筛选与灯箱预览',
  ogTitle: '画廊 - TixXin Blog',
  ogDescription: '用镜头记录生活的美好瞬间，支持分类筛选与灯箱预览',
  ogType: 'website',
  ogImage: mockPhotos[0]?.srcLarge,
})

const categories = mockGalleryCategories
const galleryStats = [
  { label: '演示照片', value: String(mockPhotos.length) },
  { label: '示例地点', value: String(new Set(mockPhotos.map((photo) => photo.location)).size) },
  { label: '分类', value: String(mockGalleryCategories.length - 1) },
]
const gearList = mockGearList
const photos = mockPhotos

const activeFilter = ref('all')
const keyword = ref('')
const selectedPhoto = ref<PhotoItem | null>(null)
const lightBoxVisible = ref(false)

const filteredPhotos = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase('zh-CN')
  return photos.filter(
    (photo) =>
      (activeFilter.value === 'all' || photo.category === activeFilter.value) &&
      (!query ||
        [photo.title, photo.description, photo.location].some((text) =>
          text.toLocaleLowerCase('zh-CN').includes(query),
        )),
  )
})
function clearFilters() {
  keyword.value = ''
  activeFilter.value = 'all'
}

function openLightBox(photo: PhotoItem) {
  selectedPhoto.value = photo
  lightBoxVisible.value = true
}

function closeLightBox() {
  lightBoxVisible.value = false
  selectedPhoto.value = null
}
</script>

<style lang="scss" scoped>
.gallery-result {
  margin-top: 0.75rem;
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
</style>
