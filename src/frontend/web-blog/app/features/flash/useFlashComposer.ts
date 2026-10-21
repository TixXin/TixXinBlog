/**
 * @file useFlashComposer.ts
 * @description 闪念页面底部编辑器编辑会话与草稿/发布提交状态管理
 * @author TixXin
 * @since 2026-10-21
 */

import type { FlashNote, FlashNoteDraft } from '~/features/flash/types'

export interface FlashComposerOptions {
  add: (draft: FlashNoteDraft) => Promise<FlashNote | null>
  update: (id: string, patch: Partial<FlashNoteDraft>) => Promise<FlashNote | null>
}

export function useFlashComposer(options: FlashComposerOptions) {
  const { add, update } = options
  const { t } = useI18n()
  const { success, error: showError } = useToast()

  const editingNote = ref<FlashNote | null>(null)
  const editorDirty = ref(false)
  const editorRef = ref<{ focus: () => void } | null>(null)
  const editorVersion = ref(0)
  const publishing = ref(false)

  async function onEdit(note: FlashNote) {
    if (editorDirty.value && !window.confirm(t('flash-moment.flash.confirmDiscardForEdit'))) return
    editingNote.value = note
    editorDirty.value = false
    editorVersion.value += 1
    await nextTick()
    editorRef.value?.focus()
  }

  function cancelEdit() {
    if (editorDirty.value && !window.confirm(t('flash-moment.flash.confirmDiscardChanges'))) return
    editingNote.value = null
    editorDirty.value = false
    editorVersion.value += 1
  }

  async function onSubmit(draft: FlashNoteDraft) {
    if (publishing.value) return
    publishing.value = true
    try {
      const created = editingNote.value ? await update(editingNote.value.id, draft) : await add(draft)
      if (created) {
        editingNote.value = null
        editorDirty.value = false
        editorVersion.value += 1
        success(draft.isDraft ? t('flash-moment.flash.toastDraftSaved') : t('flash-moment.flash.toastPublished'))
      }
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastSaveFailed'))
    } finally {
      publishing.value = false
    }
  }

  return {
    editingNote,
    editorDirty,
    editorRef,
    editorVersion,
    publishing,
    onEdit,
    cancelEdit,
    onSubmit,
  }
}
