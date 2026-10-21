<!--
  @file FlashEditorImages.vue
  @description 闪念编辑器图片 URL 输入折叠区与缩略图预览
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div v-if="show" class="fed__images">
    <label class="fed__images-label" :for="inputId">
      <Icon name="lucide:image" size="12" />
      <span>{{ $t('flash-moment.editor.imageUrlsLabel') }}</span>
    </label>
    <textarea
      :id="inputId"
      :value="modelValue"
      rows="3"
      class="fed__images-input"
      placeholder="https://example.com/photo.jpg"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="$emit('blur')"
    />
    <div v-if="images.length > 0" class="fed__images-thumbs">
      <span v-for="(img, idx) in images" :key="img + idx" class="fed__images-thumb">
        <img :src="img" alt="" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  inputId: string
  modelValue: string
  images: string[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
  blur: []
}>()
</script>

<style lang="scss" scoped>
.fed__images {
  margin: 0.5rem 0;
  padding: 0.625rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
}

.fed__images-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 0.375rem;
}

.fed__images-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  outline: none;
  resize: vertical;

  &:focus {
    border-color: var(--accent);
  }
}

.fed__images-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.fed__images-thumb {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
