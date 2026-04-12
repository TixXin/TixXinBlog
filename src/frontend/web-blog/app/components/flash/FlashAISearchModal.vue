<!--
  @file FlashAISearchModal.vue
  @description 闪念 AI 搜索弹窗，输入关键词后由 mock AI 整理相关笔记
  @author TixXin
  @since 2026-04-11
-->

<template>
  <Teleport to="body">
    <Transition name="flash-ai-modal">
      <div v-if="visible" class="flash-ai-modal-overlay" @click.self="close">
        <div class="flash-ai-modal">
          <div class="flash-ai-modal__header">
            <Icon name="lucide:sparkles" size="16" class="flash-ai-modal__icon" />
            <input
              ref="inputRef"
              v-model="input"
              type="text"
              class="flash-ai-modal__input"
              placeholder="问问你的闪念，比如「今年读了什么书」"
              @keydown.escape="close"
              @keydown.enter="submit"
            >
            <kbd class="flash-ai-modal__kbd">ESC</kbd>
          </div>

          <div class="flash-ai-modal__body">
            <!-- idle 状态：提示词 -->
            <div v-if="aiSearch.status.value === 'idle'" class="flash-ai-modal__hint">
              <Icon name="lucide:wand-2" size="18" />
              <p>这是 mock AI，会基于你已记录的闪念给出整理。</p>
              <p class="flash-ai-modal__hint-sub">输入关键词后回车开始。</p>
            </div>

            <!-- loading -->
            <div v-else-if="aiSearch.status.value === 'loading'" class="flash-ai-modal__loading">
              <Icon name="lucide:loader-2" size="20" class="flash-ai-modal__spinner" />
              <span>AI 正在翻阅你的闪念...</span>
            </div>

            <!-- error -->
            <div v-else-if="aiSearch.status.value === 'error'" class="flash-ai-modal__error">
              <Icon name="lucide:alert-triangle" size="18" />
              <span>{{ aiSearch.errorMsg.value }}</span>
            </div>

            <!-- success -->
            <div v-else-if="aiSearch.status.value === 'success' && aiSearch.result.value" class="flash-ai-modal__result">
              <div class="flash-ai-modal__answer">{{ aiSearch.result.value.answer }}</div>

              <div v-if="citedNotes.length > 0" class="flash-ai-modal__citations">
                <span class="flash-ai-modal__citations-label">引用的闪念</span>
                <ul class="flash-ai-modal__citation-list">
                  <li
                    v-for="n in citedNotes"
                    :key="n.id"
                    class="flash-ai-modal__citation-item"
                    @click="onCiteClick(n.id)"
                  >
                    <span class="flash-ai-modal__citation-content">{{ truncate(n.content, 80) }}</span>
                    <Icon name="lucide:arrow-right" size="11" class="flash-ai-modal__citation-arrow" />
                  </li>
                </ul>
              </div>

              <div class="flash-ai-modal__meta">
                <Icon name="lucide:timer" size="11" />
                耗时 {{ aiSearch.result.value.latencyMs }}ms（mock）
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

const props = defineProps<{
  notes: FlashNote[]
}>()

const emit = defineEmits<{
  /** 点击引用列表中的某条闪念 → 父级关闭模态 + 滚动高亮 */
  'cite-click': [noteId: string]
}>()

const visible = defineModel<boolean>('visible', { default: false })

const input = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const aiSearch = useFlashAISearch()

const citedNotes = computed<FlashNote[]>(() => {
  if (!aiSearch.result.value) return []
  const ids = new Set(aiSearch.result.value.citedNoteIds)
  return props.notes.filter((n) => ids.has(n.id))
})

watch(visible, (v) => {
  if (v) {
    input.value = ''
    aiSearch.reset()
    nextTick(() => inputRef.value?.focus())
  }
})

function submit() {
  void aiSearch.ask(input.value, props.notes)
}

function close() {
  visible.value = false
}

function onCiteClick(noteId: string) {
  emit('cite-click', noteId)
  close()
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
</script>

<style lang="scss" scoped>
.flash-ai-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(16vh, 8rem);
}

.flash-ai-modal {
  width: min(560px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.flash-ai-modal__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.flash-ai-modal__icon {
  color: var(--accent);
  flex-shrink: 0;
}

.flash-ai-modal__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.flash-ai-modal__kbd {
  font-size: 0.625rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-soft);
  flex-shrink: 0;
}

.flash-ai-modal__body {
  max-height: 420px;
  overflow-y: auto;
  padding: 1rem 1.125rem;
}

.flash-ai-modal__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1.5rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  text-align: center;

  > svg {
    color: var(--accent);
  }
}

.flash-ai-modal__hint-sub {
  color: var(--text-faint);
  font-size: 0.75rem;
}

.flash-ai-modal__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 1.5rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.flash-ai-modal__spinner {
  color: var(--accent);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.flash-ai-modal__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--danger);
  background: var(--surface-2);
  border-radius: $radius-md;
  font-size: 0.8125rem;
}

.flash-ai-modal__result {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.flash-ai-modal__answer {
  white-space: pre-wrap;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-main);
  padding: 0.875rem 1rem;
  background: var(--accent-soft);
  border-radius: $radius-md;
  border-left: 3px solid var(--accent);
}

.flash-ai-modal__citations {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.flash-ai-modal__citations-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.flash-ai-modal__citation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.flash-ai-modal__citation-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  border-radius: $radius-sm;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--text-main);
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.flash-ai-modal__citation-content {
  flex: 1;
  min-width: 0;
}

.flash-ai-modal__citation-arrow {
  flex-shrink: 0;
  color: var(--text-faint);
  transition: color 0.18s;

  .flash-ai-modal__citation-item:hover & {
    color: var(--accent);
  }
}

.flash-ai-modal__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
}

/* Transition */
.flash-ai-modal-enter-active,
.flash-ai-modal-leave-active {
  transition: opacity 0.2s ease;
}

.flash-ai-modal-enter-active .flash-ai-modal,
.flash-ai-modal-leave-active .flash-ai-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.flash-ai-modal-enter-from,
.flash-ai-modal-leave-to {
  opacity: 0;
}

.flash-ai-modal-enter-from .flash-ai-modal,
.flash-ai-modal-leave-to .flash-ai-modal {
  transform: translateY(-10px) scale(0.98);
}
</style>
