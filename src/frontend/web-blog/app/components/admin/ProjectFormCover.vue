<!-- @file ProjectFormCover.vue @description 项目编辑表单的封面区块：选择或移除媒体封面，预览尺寸优先取刚选的媒体，其次取已保存项目 -->
<template>
  <section :aria-label="$t('admin-media.projectForm.cover')">
    <h2>{{ $t('admin-media.projectForm.cover') }}</h2>
    <button type="button" @click="emit('choose')">{{ $t('admin-media.projectForm.chooseCover') }}</button
    ><button v-if="coverMediaId" type="button" @click="emit('remove')">
      {{ $t('admin-media.projectForm.removeCover') }}</button
    ><CommonImageFrame
      v-if="coverMediaId"
      class="project-editor__preview"
      :src="`/api/v1/media/${coverMediaId}.webp`"
      :alt="title || $t('admin-media.projectForm.cover')"
      :width="size?.width"
      :height="size?.height"
      fit="contain"
    />
    <p v-else>{{ $t('admin-media.projectForm.noCoverHint') }}</p>
    <p>{{ $t('admin-media.projectForm.mediaHint') }}</p>
  </section>
</template>
<script setup lang="ts">
import type { ManagedProject } from '~/features/project/types'
import type { MediaAsset } from '~/features/media/types'

const props = defineProps<{
  coverMediaId: string | null
  title: string
  saved: ManagedProject | null
  selectedMedia: MediaAsset | null
}>()
const emit = defineEmits<{ choose: []; remove: [] }>()
const size = computed(() => {
  if (props.selectedMedia?.id === props.coverMediaId)
    return { width: props.selectedMedia.width, height: props.selectedMedia.height }
  if (props.saved?.coverMediaId === props.coverMediaId)
    return { width: props.saved.width ?? undefined, height: props.saved.height ?? undefined }
  return undefined
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/project-editor' as project;

@include project.form;
</style>
