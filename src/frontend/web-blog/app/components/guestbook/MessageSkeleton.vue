<!--
  @file MessageSkeleton.vue
  @description 留言板消息骨架屏
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div class="msg-skeleton">
    <div v-for="i in count" :key="i" class="msg-skeleton__item" :class="{ 'msg-skeleton__item--right': i % 3 === 0 }">
      <div class="msg-skeleton__avatar skeleton-pulse" />
      <div class="msg-skeleton__body">
        <div class="msg-skeleton__meta">
          <div class="msg-skeleton__name skeleton-pulse" />
          <div class="msg-skeleton__time skeleton-pulse" />
        </div>
        <div
          class="msg-skeleton__bubble skeleton-pulse"
          :style="{ width: bubbleWidths[i - 1] }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  count?: number
}>(), {
  count: 6,
})

/** 随机气泡宽度，让骨架屏看起来更自然 */
const bubbleWidths = Array.from({ length: props.count }, (_, i) => {
  const widths = ['45%', '60%', '75%', '55%', '80%', '50%', '65%', '70%']
  return widths[i % widths.length]
})
</script>

<style lang="scss" scoped>
.msg-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem 1.25rem 1.5rem;
}

.msg-skeleton__item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;

  &--right {
    flex-direction: row-reverse;

    .msg-skeleton__body {
      align-items: flex-end;
    }
  }
}

.msg-skeleton__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  flex-shrink: 0;
}

.msg-skeleton__body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.msg-skeleton__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.msg-skeleton__name {
  width: 4rem;
  height: 0.625rem;
  border-radius: 3px;
}

.msg-skeleton__time {
  width: 2.5rem;
  height: 0.5rem;
  border-radius: 3px;
}

.msg-skeleton__bubble {
  height: 2.5rem;
  border-radius: 1rem;
  max-width: 80%;
}

/* 骨架屏脉冲动画 */
.skeleton-pulse {
  background: var(--surface-2);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}
</style>
