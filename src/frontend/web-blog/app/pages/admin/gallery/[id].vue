<!-- @file [id].vue @description 编辑图库作品，页面身份与作品编号绑定 -->
<template>
  <ClientOnly
    ><AdminGalleryForm
      :id="editor.id.value"
      :value="editor.form"
      :saved="editor.saved.value"
      :server-version="editor.serverVersion.value"
      :recovery="editor.recovery.value"
      :ready="editor.ready.value"
      :loading="editor.loading.value"
      :saving="editor.saving.value"
      :dirty="editor.dirty.value"
      :error="editor.error.value"
      :notice="editor.notice.value"
      :local-error="editor.localError.value"
      @change="editor.change"
      @save="editor.save"
      @reload="editor.reload"
      @restore="editor.restoreRecovery"
      @discard="editor.discardRecovery"
      @persist="editor.persistLocal"
      @merge="editor.mergeConflict"
  /></ClientOnly>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: (route) => route.path })
useSeoMeta({ title: '编辑照片作品', robots: 'noindex, nofollow' })
const editor = useAdminGalleryEditor(Number(useRoute().params.id))
</script>
