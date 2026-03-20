<!--
  @file gallery.vue
  @description 画廊页面，瀑布流照片、分类筛选与灯箱预览
  @author TixXin
  @since 2026-03-20
-->

<template>
  <LayoutBlogShell>
    <template #left>
      <LayoutSidebarNav />
      <BlogSubscribeCard />
      <BlogThemeSwitcher />
    </template>

    <template #center>
      <header class="gallery-header">
        <CommonSearchBox placeholder="搜索照片..." />
      </header>
      <CommonPageHeader
        title="画廊"
        subtitle="用镜头记录生活的美好瞬间"
        icon="lucide:image"
      />
      <div class="gallery-body">
        <GalleryFilter
          v-model="activeFilter"
          :categories="categories"
        />
        <GalleryGrid
          :photos="filteredPhotos"
          @select="openLightBox"
        />
      </div>
      <GalleryLightBox
        :photo="selectedPhoto"
        :visible="lightBoxVisible"
        @close="closeLightBox"
      />
    </template>

    <template #right>
      <SidebarRightSidebar>
        <GalleryStats :stats="galleryStats" />
        <GalleryGearCard :gear="gearList" />
      </SidebarRightSidebar>
    </template>
  </LayoutBlogShell>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'
import {
  mockGalleryCategories,
  mockGalleryStats,
  mockGearList,
  mockPhotos,
} from '~/features/gallery/mock'

const categories = mockGalleryCategories
const galleryStats = mockGalleryStats
const gearList = mockGearList
const photos = mockPhotos

const activeFilter = ref('all')
const selectedPhoto = ref<PhotoItem | null>(null)
const lightBoxVisible = ref(false)

const filteredPhotos = computed(() => {
  if (activeFilter.value === 'all') {
    return photos
  }
  return photos.filter(p => p.category === activeFilter.value)
})

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
.gallery-header {
  padding: 1.5rem 2rem 0.5rem;
  display: flex;
  justify-content: flex-end;
}

.gallery-body {
  flex: 1;
  padding: 0 2rem 2rem;
  overflow-y: auto;
}
</style>
