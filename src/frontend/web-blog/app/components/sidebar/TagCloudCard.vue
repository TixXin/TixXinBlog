<!--
  @file TagCloudCard.vue
  @description 右侧栏标签云卡片组件，以多行滚动方式展示标签
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card tag-cloud-card">
    <div class="tag-cloud-card__header">
      <h3 class="tag-cloud-card__title"><Icon name="lucide:hash" size="16" /> 探索标签</h3>
      <span class="tag-cloud-card__count text-xs">{{ tags.length }} 个标签</span>
    </div>
    <div class="tag-cloud-card__rows">
      <div v-for="(row, rowIdx) in tagRows" :key="rowIdx" class="tag-cloud-card__row">
        <div
          class="tag-cloud-card__track"
          :class="rowIdx % 2 === 0 ? 'tag-cloud-card__track--left' : 'tag-cloud-card__track--right'"
          :style="{ animationDuration: rowSpeeds[rowIdx] }"
        >
          <span v-for="(tag, i) in [...row, ...row]" :key="`${rowIdx}-${i}`" class="tag-cloud-card__tag">
            <span class="tag-cloud-card__hash" :style="{ color: tag.color }">#</span>
            {{ tag.name }}
            <span class="tag-cloud-card__tag-count">{{ tag.count }}</span>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TagItem } from '~/features/stats/types'

const props = defineProps<{
  tags: TagItem[]
}>()

const rowSpeeds = ['22s', '18s', '25s', '20s']

const tagRows = computed(() => {
  const rows: TagItem[][] = [[], [], [], []]
  props.tags.forEach((tag, i) => {
    rows[i % 4]!.push(tag)
  })
  return rows
})
</script>

<style lang="scss" scoped>
.tag-cloud-card {
  padding: 1.25rem;
  overflow: hidden;
}

.tag-cloud-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tag-cloud-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.tag-cloud-card__count {
  color: var(--text-muted);
}

.tag-cloud-card__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-cloud-card__row {
  overflow: hidden;
  height: 32px;
  mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
}

.tag-cloud-card__track {
  display: flex;
  gap: 0.5rem;
  width: max-content;
  white-space: nowrap;

  &:hover {
    animation-play-state: paused;
  }

  &--left {
    animation: marquee-l linear infinite;
    will-change: transform;
  }

  &--right {
    animation: marquee-r linear infinite;
    will-change: transform;
  }
}

.tag-cloud-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  padding: 5px 12px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  background: var(--surface-1);
  color: var(--text-muted);
  border: 1px solid var(--border);
  transition: $transition-fast;
  cursor: pointer;

  &:hover {
    background: var(--accent-soft);
    color: var(--text-main);
    border-color: var(--border-hover);
  }
}

.tag-cloud-card__hash {
  font-weight: 700;
}

.tag-cloud-card__tag-count {
  color: var(--text-soft);
  font-size: 10px;
  font-weight: 500;
}

@keyframes marquee-l {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

@keyframes marquee-r {
  0% {
    transform: translateX(-50%);
  }
  100% {
    transform: translateX(0);
  }
}
</style>
