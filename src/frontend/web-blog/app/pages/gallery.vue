<!--
  @file gallery.vue
  @description 画廊页面，瀑布流照片、分类筛选与灯箱预览
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
    <CommonPageHeader title="画廊" subtitle="用镜头记录生活的美好瞬间" icon="lucide:image">
      <template #action>
        <CommonSearchBox placeholder="搜索照片..." readonly @click="openSearch" />
      </template>
    </CommonPageHeader>
    <CommonCustomScrollbar class="gallery-body" viewport-class="gallery-viewport" show-back-to-top>
      <GalleryFilter v-model="activeFilter" :categories="categories" />
      <GalleryGrid :photos="filteredPhotos" @select="openLightBox" />
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
import { mockGalleryCategories, mockGalleryStats, mockGearList, mockPhotos } from '~/features/gallery/mock'

const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}

useSeoMeta({
  title: '画廊',
  description: '用镜头记录生活的美好瞬间，支持分类筛选与灯箱预览',
  ogTitle: '画廊 - TixXin Blog',
  ogDescription: '用镜头记录生活的美好瞬间，支持分类筛选与灯箱预览',
  ogType: 'website',
  ogImage: '/og-gallery.jpg',
})

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
  return photos.filter((p) => p.category === activeFilter.value)
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
.gallery-body {
  flex: 1;
  padding: 0;
}

:deep(.gallery-viewport) {
  padding: 0 2rem 2rem;
}
</style>
