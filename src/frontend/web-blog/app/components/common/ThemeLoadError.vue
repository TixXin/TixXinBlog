<!--
  @file ThemeLoadError.vue
  @description 主题组件失败时提供可直接刷新的错误反馈
  @author TixXin
  @since 2026-09-07
-->
<template>
  <section class="theme-error-recovery">
    <section class="theme-component-error" role="alert">
      <p>{{ snapshot ? $t('layout.themeError.readonly') : $t('layout.themeError.failed') }}</p>
      <div class="theme-error-recovery__actions">
        <button v-if="retry" type="button" class="btn-primary" :disabled="retrying" @click="retry">
          {{ $t('layout.themeError.retry') }}
        </button>
        <a :href="route.fullPath" :class="retry ? 'theme-error-recovery__reload' : 'btn-primary'">{{
          $t('layout.themeError.reload')
        }}</a>
      </div>
    </section>
    <!-- eslint-disable-next-line vue/no-v-html -- 仅恢复本应用已净化的SSR输出，捕获时禁用交互控件，不接受外部HTML输入 -->
    <div v-if="snapshot" class="theme-static-content" v-html="snapshot" />
  </section>
</template>
<script setup lang="ts">
const route = useRoute()
defineProps<{ snapshot?: string | null; retry?: (() => void) | null; retrying?: boolean }>()
</script>
<style lang="scss" scoped>
.theme-error-recovery__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.theme-error-recovery__reload {
  color: var(--text-soft);
  font-size: 0.8125rem;
  text-decoration: underline;
}
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
