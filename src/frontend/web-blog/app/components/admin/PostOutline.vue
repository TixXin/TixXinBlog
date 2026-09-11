<!-- @file PostOutline.vue @description 长文章章节选择；明确定位操作保持原生键盘选项和正文输入彼此独立。 -->
<template>
  <section class="post-outline" aria-label="正文章节导航">
    <label>
      正文章节（{{ headings.length }}）
      <select v-model="selected" aria-label="选择正文章节" :disabled="disabled || !headings.length">
        <option value="">选择要编辑的章节</option>
        <option v-for="(heading, index) in headings" :key="index" :value="String(index)">
          {{ '\u3000'.repeat(heading.level - 1) }}{{ heading.text || '未命名标题' }} · 第 {{ heading.line }} 行
        </option>
      </select>
    </label>
    <button type="button" data-post-outline-jump :disabled="disabled || !target" @click="jump">
      <Icon name="lucide:list-tree" aria-hidden="true" />定位章节
    </button>
    <p>{{ headings.length ? '定位后光标移到标题行首。' : '添加 Markdown 标题后，可在这里定位章节。' }}</p>
  </section>
</template>
<script setup lang="ts">
import type { PostHeading } from '~/features/post/outline'
const props = defineProps<{ headings: PostHeading[]; disabled: boolean }>()
const emit = defineEmits<{ navigate: [heading: PostHeading] }>()
const selected = ref('')
const target = computed(() => (selected.value === '' ? undefined : props.headings[Number(selected.value)]))
watch(
  () => props.headings.length,
  () => {
    if (!target.value) selected.value = ''
  },
)
function jump() {
  if (!props.disabled && target.value) emit('navigate', target.value)
}
</script>
<style scoped lang="scss">
.post-outline {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
label {
  flex: 1 1 14rem;
  min-width: 0;
  display: grid;
  gap: 0.4rem;
  color: var(--text-muted);
}
select,
button {
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.6rem;
  font: inherit;
  color: var(--text-main);
  background: var(--surface-2);
}
select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
select:disabled,
button:disabled {
  opacity: 0.5;
}
select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
button {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  color: white;
  background: var(--accent);
}
p {
  flex-basis: 100%;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
