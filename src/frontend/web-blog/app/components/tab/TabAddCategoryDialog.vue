<!--
  @file TabAddCategoryDialog.vue
  @description 新建分类对话框：输入名称 + 选择图标
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <Transition name="tab-cat-dialog">
      <div v-if="visible" class="tab-cat-dialog-overlay" @click.self="close">
        <div class="tab-cat-dialog">
          <header class="tab-cat-dialog__header">
            <Icon name="lucide:folder-plus" size="16" />
            <h3 class="tab-cat-dialog__title">新建分类</h3>
            <button type="button" class="tab-cat-dialog__close" aria-label="关闭" @click="close">
              <Icon name="lucide:x" size="16" />
            </button>
          </header>

          <form class="tab-cat-dialog__body" @submit.prevent="onSubmit">
            <!-- 分类名称 -->
            <div class="tab-cat-dialog__field">
              <label class="tab-cat-dialog__label" for="cat-name">
                分类名称 <span class="tab-cat-dialog__required">*</span>
              </label>
              <input
                id="cat-name"
                ref="nameInputRef"
                v-model.trim="form.name"
                type="text"
                class="tab-cat-dialog__input"
                placeholder="例如：工作、阅读、游戏"
                maxlength="20"
                required
              >
            </div>

            <!-- 图标选择 -->
            <div class="tab-cat-dialog__field">
              <label class="tab-cat-dialog__label">
                选择图标
              </label>
              <TabIconPicker v-model="form.icon" />
            </div>

            <button type="submit" class="tab-cat-dialog__submit" :disabled="!form.name">
              <Icon name="lucide:check" size="14" />
              <span>创建分类</span>
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { BookmarkCategoryDraft } from '~/features/tab/types'

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  submit: [draft: BookmarkCategoryDraft]
}>()

const nameInputRef = ref<HTMLInputElement | null>(null)

const form = reactive({
  name: '',
  icon: 'lucide:folder',
})

watch(visible, (v) => {
  if (v) {
    form.name = ''
    form.icon = 'lucide:folder'
    nextTick(() => nameInputRef.value?.focus())
  }
})

function close() {
  visible.value = false
}

function onSubmit() {
  if (!form.name) return
  emit('submit', {
    name: form.name,
    icon: form.icon,
    color: '',
  })
  close()
}
</script>

<style lang="scss" scoped>
.tab-cat-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(16vh, 8rem);
}

.tab-cat-dialog {
  width: min(420px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.tab-cat-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent);
}

.tab-cat-dialog__title {
  flex: 1;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.tab-cat-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.tab-cat-dialog__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-cat-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tab-cat-dialog__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.tab-cat-dialog__required {
  color: var(--danger);
}

.tab-cat-dialog__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.18s;

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus {
    border-color: var(--accent);
  }
}

.tab-cat-dialog__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: $radius-md;
  background: var(--accent);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* Transition */
.tab-cat-dialog-enter-active,
.tab-cat-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.tab-cat-dialog-enter-active .tab-cat-dialog,
.tab-cat-dialog-leave-active .tab-cat-dialog {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.tab-cat-dialog-enter-from,
.tab-cat-dialog-leave-to {
  opacity: 0;
}

.tab-cat-dialog-enter-from .tab-cat-dialog,
.tab-cat-dialog-leave-to .tab-cat-dialog {
  transform: translateY(-10px) scale(0.98);
}
</style>
