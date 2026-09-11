<!-- @file ActionBar.vue @description 长表单共用操作区，正常占位并在宽屏吸底，小屏减少遮挡 -->
<template>
  <footer
    ref="bar"
    class="admin-action-bar"
    :class="{ 'admin-action-bar--top': position === 'top' }"
    aria-label="表单操作"
    tabindex="-1"
  >
    <slot />
  </footer>
</template>
<script setup lang="ts">
import type { Ref } from 'vue'
withDefaults(defineProps<{ position?: 'top' | 'bottom' }>(), { position: 'bottom' })
const bar = ref<HTMLElement | null>(null)
const target = inject<Ref<HTMLElement | null> | null>('admin-action-target', null)
onMounted(() => {
  if (target) target.value = bar.value
})
onBeforeUnmount(() => {
  if (target?.value === bar.value) target.value = null
})
</script>
<style scoped lang="scss">
.admin-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.8rem;
  margin-top: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.65rem;
  background: var(--surface-1);
  box-shadow: 0 -4px 16px rgb(0 0 0 / 8%);
  &--top {
    top: 0;
    bottom: auto;
  }
  :deep(button) {
    min-height: 44px;
  }
  :deep(button[type='submit']) {
    background: var(--accent);
    color: var(--accent-on, #fff);
    border-color: var(--accent);
    font-weight: 600;
  }
  @media (max-width: 760px), (max-height: 500px) {
    position: static;
  }
}
</style>
