<!-- @file PostDisplayModeToggle.vue @description 文章列表展示模式（瀑布流与分页）切换按钮组 -->
<template>
  <div class="display-mode-toggle" role="group" :aria-label="$t('article.home.displayMode')">
    <CommonTooltip :content="$t('article.home.waterfall')">
      <button
        type="button"
        :aria-label="$t('article.home.waterfall')"
        :aria-pressed="modelValue === 'waterfall'"
        class="display-mode-toggle__btn"
        :class="{ 'display-mode-toggle__btn--active': modelValue === 'waterfall' }"
        @click="emit('update:modelValue', 'waterfall')"
      >
        <Icon name="lucide:scroll-text" size="15" />
      </button>
    </CommonTooltip>
    <CommonTooltip :content="$t('article.home.pagination')">
      <button
        type="button"
        :aria-label="$t('article.home.pagination')"
        :aria-pressed="modelValue === 'pagination'"
        class="display-mode-toggle__btn"
        :class="{ 'display-mode-toggle__btn--active': modelValue === 'pagination' }"
        @click="emit('update:modelValue', 'pagination')"
      >
        <Icon name="lucide:book-open" size="15" />
      </button>
    </CommonTooltip>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: 'waterfall' | 'pagination'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'waterfall' | 'pagination'): void
}>()
</script>

<style lang="scss" scoped>
.display-mode-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  overflow: hidden;
  flex-shrink: 0;
}
.display-mode-toggle__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-soft);
  background: transparent;
  cursor: var(--interaction-cursor, pointer);
  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
  &--active {
    color: var(--text-main);
    background: var(--surface-3);
  }
  & + & {
    border-left: 1px solid var(--border);
  }
}
</style>
