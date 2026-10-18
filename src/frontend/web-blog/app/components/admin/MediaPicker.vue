<!--
  @file MediaPicker.vue
  @description 可复用媒体选择对话框，上传中的关闭需要明确确认。
-->
<template>
  <dialog
    ref="dialog"
    class="media-picker"
    aria-labelledby="media-picker-title"
    @cancel.prevent="close"
    @close="open = false"
  >
    <header class="media-picker__toolbar">
      <h2 id="media-picker-title">选择媒体图片</h2>
      <button type="button" @click="close">关闭媒体选择器</button>
    </header>
    <AdminMediaWorkspace v-if="open" selectable @selected="select" @busy="busy = $event" />
  </dialog>
</template>
<script setup lang="ts">
import type { MediaAsset } from '~/features/media/types'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ selected: [asset: MediaAsset] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const busy = ref(false)
watch(
  open,
  async (value) => {
    await nextTick()
    if (value && !dialog.value?.open) dialog.value?.showModal()
    else if (!value) dialog.value?.close()
  },
  { immediate: true },
)
function close() {
  if (
    busy.value &&
    !window.confirm(
      '仍有上传或未保存的替代文本、素材说明，关闭会停止等待并放弃未保存输入；已上传资源保留。确定关闭吗？',
    )
  )
    return
  open.value = false
  dialog.value?.close()
}
function select(asset: MediaAsset) {
  if (busy.value) return
  emit('selected', asset)
  open.value = false
  dialog.value?.close()
}
</script>
<style scoped lang="scss">
.media-picker {
  width: min(1000px, calc(100vw - 2rem));
  max-height: 90dvh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1rem;
  color: var(--text-main);
  background: var(--surface-1);
}
.media-picker::backdrop {
  background: rgba(0, 0, 0, 0.6);
}
.media-picker__toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}
h2 {
  min-width: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
button {
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  white-space: normal;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
</style>
