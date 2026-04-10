<!--
  @file MomentPhotoWallCard.vue
  @description 朋友圈右侧栏精选照片墙，展示获赞最多的图片动态
  @author TixXin
  @since 2026-04-10
-->

<template>
  <section class="card moment-photo-wall">
    <div class="moment-photo-wall__header">
      <h3 class="moment-photo-wall__title">
        <Icon name="lucide:image" size="16" />
        精选照片
      </h3>
      <span class="moment-photo-wall__count">{{ images.length }}</span>
    </div>

    <div class="moment-photo-wall__grid">
      <div
        v-for="(img, index) in images.slice(0, 9)"
        :key="index"
        class="moment-photo-wall__item"
        :class="{ 'is-featured': index === 0 }"
        @click="emit('select-moment', img.momentId)"
      >
        <NuxtImg
          :src="img.src"
          :alt="`照片 ${index + 1}`"
          class="moment-photo-wall__img"
          format="webp"
          loading="lazy"
          width="200"
          height="200"
        />
        <div class="moment-photo-wall__overlay">
          <Icon name="lucide:eye" size="14" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface MomentPhotoItem {
  src: string
  momentId: string
}

defineProps<{
  images: MomentPhotoItem[]
}>()

const emit = defineEmits<{
  'select-moment': [momentId: string]
}>()
</script>

<style lang="scss" scoped>
.moment-photo-wall {
  padding: 1.25rem;
}

.moment-photo-wall__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.moment-photo-wall__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.moment-photo-wall__count {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-3);
  padding: 2px 8px;
  border-radius: $radius-full;
  line-height: 1.4;
}

.moment-photo-wall__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.moment-photo-wall__item {
  position: relative;
  border-radius: $radius-sm;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 1;

  /* 第一张图片占 2x2 突出显示 */
  &.is-featured {
    grid-column: span 2;
    grid-row: span 2;
  }
}

.moment-photo-wall__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.moment-photo-wall__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.moment-photo-wall__item:hover {
  .moment-photo-wall__img {
    transform: scale(1.03);
  }

  .moment-photo-wall__overlay {
    opacity: 1;
  }
}
</style>
