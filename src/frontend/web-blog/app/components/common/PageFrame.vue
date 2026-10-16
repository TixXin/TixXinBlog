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
    </div>
    <slot name="overlays" />
  </div>
</template>
<script setup lang="ts">
defineProps<{ headerKey: string }>()
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
</style>
