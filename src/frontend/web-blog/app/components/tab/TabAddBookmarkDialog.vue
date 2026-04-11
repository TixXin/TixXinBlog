<!--
  @file TabAddBookmarkDialog.vue
  @description 新建书签弹窗：名称、URL、所属分类、可选颜色
  @author TixXin
  @since 2026-04-11
-->

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="tab-dialog" role="dialog" aria-modal="true" @click.self="close">
        <div class="tab-dialog__panel">
          <header class="tab-dialog__header">
            <Icon name="lucide:bookmark-plus" size="18" />
            <h2 class="tab-dialog__title">添加书签</h2>
            <button type="button" class="tab-dialog__close" aria-label="关闭" @click="close">
              <Icon name="lucide:x" size="16" />
            </button>
          </header>

          <form class="tab-dialog__form" @submit.prevent="onSubmit">
            <label class="tab-dialog__field">
              <span>名称</span>
              <input v-model.trim="name" type="text" required placeholder="例如：GitHub" >
            </label>
            <label class="tab-dialog__field">
              <span>网址</span>
              <input v-model.trim="url" type="url" required placeholder="https://example.com" >
            </label>
            <label class="tab-dialog__field">
              <span>分类</span>
              <select v-model="categoryId" required>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </label>
            <label class="tab-dialog__field">
              <span>颜色（可选）</span>
              <div class="tab-dialog__color">
                <input v-model="color" type="color" >
                <span>{{ color }}</span>
              </div>
            </label>

            <div class="tab-dialog__actions">
              <button type="button" class="tab-dialog__btn tab-dialog__btn--ghost" @click="close">取消</button>
              <button type="submit" class="tab-dialog__btn tab-dialog__btn--primary" :disabled="!canSubmit">
                添加
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { BookmarkCategory, BookmarkDraft } from '~/features/tab/types'

const props = defineProps<{
  categories: BookmarkCategory[]
  defaultCategoryId?: string | null
}>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ submit: [draft: BookmarkDraft] }>()

const name = ref('')
const url = ref('')
const categoryId = ref('')
const color = ref('#3b82f6')

const canSubmit = computed(() => name.value && url.value && categoryId.value)

watch(visible, (v) => {
  if (v) {
    name.value = ''
    url.value = ''
    color.value = '#3b82f6'
    categoryId.value = props.defaultCategoryId || props.categories[0]?.id || ''
  }
})

function close() {
  visible.value = false
}

function onSubmit() {
  if (!canSubmit.value) return
  let finalUrl = url.value
  if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`
  emit('submit', {
    name: name.value,
    url: finalUrl,
    color: color.value,
    categoryId: categoryId.value,
  })
  close()
}
</script>

<style lang="scss" scoped>
.tab-dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.tab-dialog__panel {
  width: 100%;
  max-width: 420px;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-elevated, var(--shadow-card));
  overflow: hidden;
}

.tab-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent);
}

.tab-dialog__title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.tab-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
  }
}

.tab-dialog__form {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-soft);

  input[type='text'],
  input[type='url'],
  select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-soft);
    border-radius: $radius-md;
    background: var(--surface-2);
    color: var(--text-main);
    font-size: 0.875rem;
    outline: none;

    &:focus {
      border-color: var(--accent);
      background: var(--surface-1);
    }
  }
}

.tab-dialog__color {
  display: flex;
  align-items: center;
  gap: 0.625rem;

  input[type='color'] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: $radius-sm;
    background: transparent;
    cursor: pointer;
  }

  span {
    font-family: 'Inter', monospace;
    font-size: 0.75rem;
    color: var(--text-soft);
  }
}

.tab-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.tab-dialog__btn {
  padding: 0.5rem 1.125rem;
  border-radius: $radius-md;
  border: 1px solid transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &--ghost {
    background: transparent;
    border-color: var(--border-soft);
    color: var(--text-soft);

    &:hover {
      background: var(--surface-2);
      color: var(--text-main);
    }
  }

  &--primary {
    background: var(--accent);
    color: #fff;

    &:hover:not(:disabled) {
      opacity: 0.88;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.18s ease;

  .tab-dialog__panel {
    transition: transform 0.18s ease;
  }
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .tab-dialog__panel {
    transform: scale(0.96);
  }
}
</style>
