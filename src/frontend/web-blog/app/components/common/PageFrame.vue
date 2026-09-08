<!--
  @file PageFrame.vue
  @description 普通页面的标题、正文和浮层边界，SSR直接输出，动效不会移动主题卡片外壳
-->
<template>
  <div class="page-frame" data-page-frame :data-page-header-key="headerKey">
    <div v-if="$slots.header" class="page-frame__header" data-page-header>
      <slot name="header" />
    </div>
    <div class="page-frame__body" data-page-body-frame>
      <div class="page-frame__content" data-page-body>
        <slot />
      </div>
      <p v-if="pending" class="page-frame__pending" data-page-motion-status role="status">正在加载内容…</p>
    </div>
    <slot name="overlays" />
  </div>
</template>
<script setup lang="ts">
import { pageMotionPendingKey } from '~/utils/pageMotionRegions'

defineProps<{ headerKey: string }>()
const pending = inject(pageMotionPendingKey, ref(false))
</script>
<style lang="scss" scoped>
.page-frame,
.page-frame__body,
.page-frame__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
}
.page-frame__header {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.page-frame__body {
  position: relative;
  // 裁切入场位移，但不创建第二个滚动容器；弹窗由独立浮层插槽或Teleport承载。
  overflow: clip;
}
.page-frame__pending {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  margin: 0;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-full;
  background: var(--surface-1);
  color: var(--text-soft);
  font-size: 0.8125rem;
  pointer-events: none;
}
</style>
