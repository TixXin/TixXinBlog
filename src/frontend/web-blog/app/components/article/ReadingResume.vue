<!--
  @file ReadingResume.vue
  @description 文章阅读恢复提示：展示上次进度与预计阅读时间，由页面处理跳转
-->
<template>
  <div class="reading-resume">
    <p :id="statusId" class="reading-resume__status" role="status">
      <span>上次读到 {{ Math.round(progress) }}%</span>
      <span class="reading-resume__time">
        <Icon name="lucide:clock" size="14" aria-hidden="true" />
        预计阅读 {{ readTime }}
      </span>
    </p>
    <CommonTooltip content="跳转到这篇文章上次的阅读位置" placement="bottom">
      <button type="button" class="reading-resume__button" :aria-describedby="statusId" @click="emit('resume')">
        <Icon name="lucide:book-open" size="16" aria-hidden="true" />
        继续上次阅读
      </button>
    </CommonTooltip>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  progress: number
  readTime: string
}>()

const emit = defineEmits<{ resume: [] }>()
const statusId = useId()
</script>

<style lang="scss" scoped>
.reading-resume {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
}

.reading-resume__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 1rem;
  margin: 0;
  min-width: 0;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.reading-resume__time {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-muted);
}

.reading-resume__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  max-width: 100%;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--accent-soft);
  color: var(--accent-text);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
}
</style>
