<!--
  @file ThemeLoadError.vue
  @description 主题组件失败时提供可直接刷新的错误反馈
  @author TixXin
  @since 2026-09-07
-->
<template>
  <section class="theme-error-recovery">
    <section class="theme-component-error" role="alert">
      <p>{{ snapshot ? '页面交互暂不可用，已保留只读内容。' : '这部分内容暂时无法加载。' }}</p>
      <a :href="route.fullPath" class="btn-primary">刷新重试</a>
    </section>
    <!-- eslint-disable-next-line vue/no-v-html -- 仅恢复本应用已净化的SSR输出，捕获时禁用交互控件，不接受外部HTML输入 -->
    <div v-if="snapshot" class="theme-static-content" v-html="snapshot" />
  </section>
</template>
<script setup lang="ts">
const route = useRoute()
defineProps<{ snapshot?: string | null }>()
</script>
<style lang="scss" scoped>
.theme-error-recovery {
  width: 100%;
}
.theme-static-content {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1rem;
  :deep(.main-content),
  :deep(.main-inner),
  :deep(.custom-scrollbar),
  :deep(.custom-scrollbar__viewport) {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  :deep(.image-frame__image) {
    opacity: 1 !important;
  }
  :deep(.image-frame__status) {
    display: none !important;
  }
  :deep(.anim-fade-in-up) {
    opacity: 1 !important;
    animation: none !important;
  }
}
</style>
