<!--
  @file GalleryGrid.vue
  @description 画廊瀑布流容器，基于 CSS columns 布局
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="gallery-grid">
    <div
      v-for="photo in photos"
      :key="photo.id"
      class="gallery-grid__cell"
    >
      <GalleryItem
        :photo="photo"
        @click="$emit('select', photo)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PhotoItem } from '~/features/gallery/types'

defineProps<{
  photos: PhotoItem[]
}>()

defineEmits<{
  select: [photo: PhotoItem]
}>()
</script>

<style lang="scss" scoped>
.gallery-grid {
  columns: 2;
  column-gap: 1rem;
}

.gallery-grid__cell {
  break-inside: avoid;
  margin-bottom: 1rem;
}
</style>
