<!--
  @file TabIconPickerUpload.vue
  @description 图标选择器的上传面板：选择本地图片、读取失败或超限提示，以及当前图片预览与清除
  @author TixXin
  @since 2026-10-27
-->

<template>
  <div class="icon-picker__pane icon-picker__upload">
    <label class="icon-picker__upload-dropzone">
      <input type="file" accept="image/*" class="icon-picker__upload-input" @change="emit('upload', $event)" />
      <Icon name="lucide:upload" size="24" />
      <span class="icon-picker__upload-hint">
        <strong>{{ $t('misc.tab.iconPicker.uploadClick') }}</strong
        >{{ $t('misc.tab.iconPicker.uploadDrag') }}
        <small>{{ $t('misc.tab.iconPicker.uploadHint') }}</small>
      </span>
    </label>
    <p v-if="uploadError" class="icon-picker__upload-error">
      <Icon name="lucide:alert-circle" size="12" />
      {{ uploadError }}
    </p>
    <div v-if="isDataUrl" class="icon-picker__upload-preview">
      <img :src="modelValue" :alt="$t('misc.tab.iconPicker.preview')" />
      <button type="button" class="icon-picker__upload-clear" @click="emit('clear')">
        <Icon name="lucide:x" size="11" />
        {{ $t('misc.tab.iconPicker.clear') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string; uploadError: string }>()
const emit = defineEmits<{ upload: [event: Event]; clear: [] }>()

const isDataUrl = computed(() => props.modelValue.startsWith('data:'))
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-icon-picker' as picker;

@include picker.picker;
</style>
