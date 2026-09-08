<!--
  @file ImageFrame.vue
  @description 保留图片比例的加载容器：慢图和破图保持占位，提供可键盘操作的重试
  @author TixXin
  @since 2026-09-07
-->
<template>
  <div class="image-frame" :class="`image-frame--${state}`" :aria-busy="state === 'loading'" :style="frameStyle">
    <img
      v-if="src"
      :key="attempt"
      ref="image"
      class="image-frame__image"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="loading"
      @load="loaded"
      @error="failed"
    />
    <span v-if="state === 'loading'" class="image-frame__status" aria-hidden="true">图片加载中…</span>
    <div v-else-if="state === 'error' || state === 'empty'" class="image-frame__status">
      <Icon name="lucide:image-off" size="22" aria-hidden="true" />
      <span>{{ state === 'empty' ? '暂无图片' : '图片暂时无法加载' }}</span>
      <button v-if="src" type="button" :aria-label="`重新加载图片：${alt}`" @click.stop.prevent="retry" @keydown.stop>
        重新加载
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src?: string
    alt: string
    width?: number
    height?: number
    fit?: 'cover' | 'contain'
    loading?: 'eager' | 'lazy'
    maxHeight?: string
  }>(),
  { src: '', fit: 'cover', loading: 'lazy', maxHeight: undefined, width: undefined, height: undefined },
)
const { image, state, attempt, loaded, failed, retry } = useImageState(() => props.src)
const frameStyle = computed(() => ({
  aspectRatio: props.width && props.height ? `${props.width} / ${props.height}` : '3 / 2',
  maxHeight: props.maxHeight,
  '--image-fit': props.fit === 'contain' ? 'scale-down' : props.fit,
}))
</script>
<style lang="scss" scoped>
.image-frame {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--surface-2);
  border-radius: inherit;
  &--ready {
    background: transparent;
  }
}
.image-frame__image {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: var(--image-fit);
  opacity: 1;
  html.app-client-ready .image-frame--loading &,
  html.app-client-ready .image-frame--error & {
    opacity: 0;
  }
}
.image-frame__status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  padding: 0.75rem;
  button {
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    color: var(--accent-text);
    border: 1px solid var(--border);
    border-radius: $radius-sm;
    background: var(--surface-1);
  }
}

// 未启动JavaScript时保留原生图片；启动后的异步图片才显示交互加载反馈。
html:not(.app-client-ready) .image-frame__status {
  display: none;
}
</style>
