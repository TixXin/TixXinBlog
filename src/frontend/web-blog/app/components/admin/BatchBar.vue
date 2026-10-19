<!--
  @file BatchBar.vue
  @description 后台列表批量操作栏：当前页全选（含半选状态）、选中数量的礼貌播报与批量动作按钮，动作由页面处理；
    noun 与动作名称由调用方传入已翻译文本；noun 可传按数量取单复数的函数，选中数量播报按实际数量取形式
-->
<template>
  <div class="admin-batch-bar" role="group" :aria-label="t('admin-system.shared.batch.label', { noun: plural })">
    <label class="admin-batch-bar__all">
      <input
        ref="allInput"
        type="checkbox"
        :checked="allSelected"
        :disabled="disabled || !pageCount"
        @change="$emit('toggle-all', ($event.target as HTMLInputElement).checked)"
      />{{ t('admin-system.shared.batch.selectAll', { noun: plural }) }}
    </label>
    <p class="admin-batch-bar__count" role="status" aria-live="polite" aria-atomic="true">
      {{
        count
          ? t('admin-system.shared.batch.selected', { count, noun: batchNounText(noun, count) })
          : t('admin-system.shared.batch.noneSelected', { noun: plural })
      }}
    </p>
    <div class="admin-batch-bar__actions">
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        :class="{ 'admin-batch-bar__danger': action.danger }"
        :disabled="disabled || !count"
        :aria-busy="busy === action.key"
        @click="$emit('action', action.key)"
      >
        <Icon :name="action.icon" aria-hidden="true" />{{ action.label }}
      </button>
      <button type="button" :disabled="disabled || !count" @click="$emit('clear')">
        {{ t('admin-system.shared.batch.clear') }}
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { batchNounText, type AdminBatchAction, type AdminBatchNoun } from '~/composables/useAdminBatchSelection'
const props = defineProps<{
  noun: AdminBatchNoun
  count: number
  pageCount: number
  allSelected: boolean
  partiallySelected: boolean
  actions: AdminBatchAction[]
  disabled?: boolean
  busy?: string
}>()
defineEmits<{ 'toggle-all': [value: boolean]; action: [key: string]; clear: [] }>()
const { t } = useI18n()
const plural = computed(() => batchNounText(props.noun))
const allInput = ref<HTMLInputElement | null>(null)
// indeterminate 只能通过 DOM 属性设置，原生复选框会向辅助技术报告“部分选中”。
watchEffect(() => {
  if (allInput.value) allInput.value.indeterminate = props.partiallySelected
})
</script>
<style scoped lang="scss">
.admin-batch-bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  margin-block: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-1);
}
.admin-batch-bar__all {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
}
.admin-batch-bar__all input {
  width: 1.1rem;
  height: 1.1rem;
}
.admin-batch-bar__count {
  margin: 0;
  color: var(--text-muted);
}
.admin-batch-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.admin-batch-bar button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
.admin-batch-bar button:disabled {
  opacity: 0.5;
}
.admin-batch-bar__danger {
  border-color: var(--danger, #d14343);
}
</style>
