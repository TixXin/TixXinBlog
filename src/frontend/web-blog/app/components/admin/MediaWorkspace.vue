<!--
  @file MediaWorkspace.vue
  @description 媒体流程容器：编排 composable，并向纯展示媒体库注入状态和动作。
-->
<template>
  <AdminMediaLibrary :selectable="selectable" :controller="controller" @selected="$emit('selected', $event)" />
</template>
<script setup lang="ts">
import type { MediaAsset } from '~/features/media/types'
const props = withDefaults(defineProps<{ selectable?: boolean }>(), { selectable: false })
const emit = defineEmits<{ selected: [asset: MediaAsset]; busy: [value: boolean] }>()
const controller = useMediaLibrary(props.selectable)
watch(controller.busy, (value) => emit('busy', value), { immediate: true })
</script>
