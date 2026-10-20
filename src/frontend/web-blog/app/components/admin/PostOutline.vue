<!-- @file PostOutline.vue @description 长文章章节选择；明确定位操作保持原生键盘选项和正文输入彼此独立。 -->
<template>
  <section class="post-outline" :aria-label="$t('admin-content.postOutline.region')">
    <label>
      {{ $t('admin-content.postOutline.label', { count: headings.length }) }}
      <select
        v-model="selected"
        :aria-label="$t('admin-content.postOutline.select')"
        :disabled="disabled || !headings.length"
      >
        <option value="">{{ $t('admin-content.postOutline.placeholder') }}</option>
        <option v-for="(heading, index) in headings" :key="index" :value="String(index)">
          {{ '\u3000'.repeat(heading.level - 1)
          }}{{
            $t('admin-content.postOutline.option', {
              text: heading.text || $t('admin-content.postOutline.untitled'),
              line: heading.line,
            })
          }}
        </option>
      </select>
    </label>
    <button type="button" data-post-outline-jump :disabled="disabled || !target" @click="jump">
      <Icon name="lucide:list-tree" aria-hidden="true" />{{ $t('admin-content.postOutline.jump') }}
    </button>
    <p>{{ headings.length ? $t('admin-content.postOutline.hint') : $t('admin-content.postOutline.empty') }}</p>
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

select {
  width: 100%;
}

p {
  flex-basis: 100%;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
