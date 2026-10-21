<!-- @file EditorFooter.vue @description 提示词编辑器页脚：保存状态提示与草稿/发布操作按钮 -->
<template>
  <footer class="prompt-editor__footer">
    <div class="prompt-editor__save-state">
      <p role="status" :class="{ 'prompt-editor__save-error': hasError }">
        <Icon :name="hasError ? 'lucide:circle-alert' : 'lucide:circle-dot'" size="13" />{{ footerStatus }}
      </p>
      <small v-if="status === 'published'">{{ $t('misc.prompt.editor.unpublishHint') }}</small>
      <small v-else class="prompt-editor__shortcut-hint">{{ $t('misc.prompt.editor.shortcutHint') }}</small>
    </div>
    <div class="prompt-editor__actions">
      <button
        type="button"
        class="prompt-editor__secondary"
        :aria-keyshortcuts="status === 'draft' ? 'Control+s Meta+s' : undefined"
        :disabled="!ready || loading || saving"
        @click="$emit('submit', 'draft')"
      >
        {{
          saving
            ? $t('misc.prompt.editor.saving')
            : status === 'published'
              ? $t('misc.prompt.editor.toDraft')
              : $t('misc.prompt.editor.saveDraft')
        }}</button
      ><button
        type="button"
        class="prompt-editor__primary"
        :aria-keyshortcuts="status === 'published' ? 'Control+s Meta+s' : undefined"
        :disabled="!ready || loading || saving"
        @click="$emit('submit', 'published')"
      >
        <Icon name="lucide:arrow-up-right" size="16" />{{
          saving
            ? $t('misc.prompt.editor.saving')
            : status === 'published'
              ? $t('misc.prompt.editor.saveUpdate')
              : $t('misc.prompt.editor.publish')
        }}
      </button>
    </div>
  </footer>
</template>
<script setup lang="ts">
import type { PromptStatus } from '~/features/prompt/types'

defineProps<{
  hasError: boolean
  footerStatus: string
  status: PromptStatus
  ready: boolean
  loading: boolean
  saving: boolean
}>()

defineEmits<{
  submit: [status: PromptStatus]
}>()
</script>
<style scoped lang="scss">
.prompt-editor__footer {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  background: var(--surface-1);
  padding: 1rem 2rem;
  border-top: 1px solid var(--border);
}
.prompt-editor__footer p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.prompt-editor__footer p :deep(svg) {
  flex-shrink: 0;
}
.prompt-editor__save-state {
  flex: 1 1 15rem;
  min-width: 0;
}
.prompt-editor__footer .prompt-editor__save-error {
  color: var(--danger);
}
.prompt-editor__actions {
  display: flex;
  gap: 0.6rem;
}
.prompt-editor__secondary,
.prompt-editor__primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.75rem;
}
.prompt-editor__secondary {
  background: var(--surface-2);
  color: var(--text-main);
}
.prompt-editor__primary {
  background: var(--accent-action);
  color: #fff;
  border-color: var(--accent-action);
}
button:disabled {
  opacity: 0.6;
}
@media (max-width: 720px) {
  .prompt-editor__footer {
    padding: 1rem;
  }
  .prompt-editor__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
@media (max-height: 520px) {
  .prompt-editor__footer {
    padding: 0.75rem 1rem;
    position: static;
  }
}
</style>
