<!-- @file new.vue @description 新建图库作品，编辑业务状态由页面组合 -->
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
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '新建照片作品', robots: 'noindex, nofollow' })
const editor = useAdminGalleryEditor(null)
</script>
