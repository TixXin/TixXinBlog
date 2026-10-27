<!-- @file MomentFormImages.vue @description 动态编辑表单的配图区块：最多 9 张，打开媒体库选择并可按位置移除 -->
<template>
  <section class="moment-editor__media" :aria-label="$t('admin-content.momentForm.imagesLabel')">
    <h2>{{ $t('admin-content.momentForm.imagesTitle', { count: images.length, max: 9 }) }}</h2>
    <button type="button" :disabled="images.length >= 9" @click="emit('choose')">
      {{ $t('admin-content.momentForm.pickImage') }}
    </button>
    <div class="moment-editor__images">
      <figure v-for="(url, index) in images" :key="url">
        <img :src="url" :alt="$t('admin-content.momentForm.imageAlt', { index: index + 1 })" />
        <button
          type="button"
          :aria-label="$t('admin-content.momentForm.removeImageAria', { index: index + 1 })"
          @click="
            emit(
              'change',
              images.filter((_, i) => i !== index),
            )
          "
        >
          {{ $t('admin-content.momentForm.removeImage') }}
        </button>
      </figure>
    </div>
  </section>
</template>
<script setup lang="ts">
defineProps<{ images: string[] }>()
const emit = defineEmits<{ choose: []; change: [images: string[]] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/moment-editor' as moment;

@include moment.form;
</style>
