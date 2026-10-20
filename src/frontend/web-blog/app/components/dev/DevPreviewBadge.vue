<!--
  @file DevPreviewBadge.vue
  @description 开发预览角标：地址带 ?preview=<名称>（见 useDevPreview）时固定在右下角提示当前为预览状态，
               点击可退出预览；不占页面内容位置。仅在 app.vue 的 DevOnly 中渲染，生产构建不包含
-->
<template>
  <div v-if="name" class="dev-preview-badge" role="note">
    <Icon name="lucide:eye" size="13" aria-hidden="true" />
    <span :title="`页面状态由地址参数 preview=${name} 决定，提交只做前端校验，不写入数据`">预览：{{ name }}</span>
    <button type="button" aria-label="退出开发预览" title="退出预览" @click="exit">
      <Icon name="lucide:x" size="13" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const name = computed(() => (typeof route.query.preview === 'string' ? route.query.preview : ''))

/** 去掉预览相关参数，页面按真实状态重新判定 */
function exit() {
  const query = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => key !== 'preview' && !key.startsWith('preview-')),
  )
  void router.replace({ path: route.path, query, hash: route.hash })
}
</script>

<style lang="scss" scoped>
.dev-preview-badge {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 9997;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.25rem 0.2rem 0.55rem;
  border: 1px dashed var(--border);
  border-radius: $radius-full;
  background: var(--surface-1-alpha-90);
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 600;
  backdrop-filter: blur(6px);
  opacity: 0.75;
  transition: opacity 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover,
  &:focus-within {
    opacity: 1;
  }
}
// 窄屏抬到底部导航之上，不遮挡导航按钮
@media (max-width: 760px) {
  .dev-preview-badge {
    bottom: calc(5rem + env(safe-area-inset-bottom));
  }
}
.dev-preview-badge button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: $radius-full;
  background: none;
  color: inherit;
  cursor: pointer;

  &:hover {
    background: var(--hover);
    color: var(--text-main);
  }
}
</style>
