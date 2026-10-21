/**
 * @file useFlashEditorForm.ts
 * @description 闪念编辑器表单状态流：输入展开、标签与图片提交、Markdown 快捷包裹与脏检测
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import type { FlashNoteDraft, FlashType } from '~/features/flash/types'
import type { MediaAsset } from '~/features/media/types'
import { validateFlashImageUrls, validateFlashTag } from '~/features/flash/editor'

export interface FlashEditorFormOptions {
  initial: Ref<FlashNoteDraft | null | undefined>
  maxLength: Ref<number>
  submitting: Ref<boolean>
  textareaRef: Ref<HTMLTextAreaElement | null>
  emitSubmit: (draft: FlashNoteDraft) => void
  emitDirty: (dirty: boolean) => void
}

const placeholderKeyByMood: Record<FlashType, string> = {
  idea: 'flash-moment.editor.placeholderIdea',
  todo: 'flash-moment.editor.placeholderTodo',
  memo: 'flash-moment.editor.placeholderMemo',
}

export function useFlashEditorForm(options: FlashEditorFormOptions) {
  const { initial, maxLength, submitting, textareaRef, emitSubmit, emitDirty } = options
  const { t } = useI18n()

  const content = ref(initial.value?.content ?? '')
  const validationError = ref('')
  const tags = ref<string[]>([...(initial.value?.tags ?? [])])
  const tagDraft = ref('')
  const focused = ref(false)
  const mood = ref<FlashType>(initial.value?.type ?? 'idea')
  const showTagInput = ref(false)
  const showImageInput = ref(false)
  const imageInput = ref('')
  const images = ref<string[]>([...(initial.value?.images ?? [])])
  const mediaOpen = ref(false)
  const imageInputId = useId()
  const expanded = ref(false)

  const placeholder = computed(() => t(placeholderKeyByMood[mood.value]))
  const canSubmit = computed(
    () => content.value.trim().length > 0 && content.value.length <= maxLength.value && !submitting.value,
  )

  watch([focused, () => content.value.length > 0, () => tags.value.length > 0], ([f, hasContent, hasTags]) => {
    if (f || hasContent || hasTags) expanded.value = true
  })

  function onEditorKeydown(event: KeyboardEvent) {
    if (!event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit(false)
    }
  }

  function selectMedia(asset: MediaAsset) {
    if (images.value.length >= 9 && !images.value.includes(asset.url)) {
      validationError.value = t('flash-moment.editor.tooManyImages')
      return
    }
    if (!images.value.includes(asset.url)) images.value.push(asset.url)
    imageInput.value = images.value.join('\n')
    showImageInput.value = true
  }

  function toggleExpand() {
    expanded.value = !expanded.value
    if (expanded.value) {
      void nextTick(() => textareaRef.value?.focus())
    }
  }

  function commitTag() {
    const tag = tagDraft.value.trim().replace(/^#/, '')
    if (!tag) return true
    if (!validateFlashTag(tag, tags.value)) {
      validationError.value = t('flash-moment.editor.tagLimit')
      return false
    }
    if (!tags.value.includes(tag)) {
      tags.value.push(tag)
    }
    tagDraft.value = ''
    validationError.value = ''
    return true
  }

  function removeTag(t: string) {
    tags.value = tags.value.filter((x) => x !== t)
  }

  function onTagButtonClick() {
    showTagInput.value = true
  }

  function onTagInputBlur() {
    if (tagDraft.value.trim() && !commitTag()) return
    showTagInput.value = false
  }

  function onImageButtonClick() {
    if (showImageInput.value && !commitImages()) return
    showImageInput.value = !showImageInput.value
    if (showImageInput.value && images.value.length > 0 && !imageInput.value) {
      imageInput.value = images.value.join('\n')
    }
  }

  function commitImages() {
    const result = validateFlashImageUrls(imageInput.value)
    if (!result.valid) {
      validationError.value = t('flash-moment.editor.invalidImages')
      return false
    }
    images.value = result.images
    validationError.value = ''
    return true
  }

  function insertWrap(left: string, right: string) {
    const el = textareaRef.value
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const before = content.value.slice(0, start)
    const sel = content.value.slice(start, end)
    const after = content.value.slice(end)
    const filler = sel || t('flash-moment.editor.wrapFiller')
    content.value = `${before}${left}${filler}${right}${after}`
    void nextTick(() => {
      el.focus()
      const cursor = before.length + left.length + filler.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  function insertPrefix(prefix: string) {
    const el = textareaRef.value
    if (!el) return
    const start = el.selectionStart ?? 0
    const before = content.value.slice(0, start)
    const after = content.value.slice(start)
    const lineStart = before.lastIndexOf('\n') + 1
    content.value = `${before.slice(0, lineStart)}${prefix}${before.slice(lineStart)}${after}`
    void nextTick(() => {
      el.focus()
      const cursor = start + prefix.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  function submit(asDraft = false) {
    if (!canSubmit.value) return
    if (tagDraft.value.trim() && !commitTag()) return
    if (showImageInput.value && !commitImages()) return
    emitSubmit({
      content: content.value.trim(),
      isDraft: asDraft,
      tags: [...tags.value],
      type: mood.value,
      images: images.value.length > 0 ? [...images.value] : undefined,
    })
  }

  const initialState = JSON.stringify([content.value, tags.value, images.value, mood.value])
  watch(
    [content, tags, images, mood, tagDraft, imageInput],
    () =>
      emitDirty(
        !!tagDraft.value.trim() ||
          (showImageInput.value && imageInput.value.trim() !== images.value.join('\n')) ||
          JSON.stringify([content.value, tags.value, images.value, mood.value]) !== initialState,
      ),
    { deep: true },
  )

  return {
    content,
    validationError,
    tags,
    tagDraft,
    focused,
    mood,
    showTagInput,
    showImageInput,
    imageInput,
    images,
    mediaOpen,
    imageInputId,
    expanded,
    placeholder,
    canSubmit,
    onEditorKeydown,
    selectMedia,
    toggleExpand,
    commitTag,
    removeTag,
    onTagButtonClick,
    onTagInputBlur,
    onImageButtonClick,
    commitImages,
    insertWrap,
    insertPrefix,
    submit,
  }
}
