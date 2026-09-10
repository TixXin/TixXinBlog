<!-- @file [id].vue @description 编辑友链，页面身份与友链编号绑定 -->
<template>
  <ClientOnly
    ><AdminLinkEditorForm
      :id="editor.id.value"
      :value="editor.form"
      :saved="editor.saved.value"
      :server-version="editor.serverVersion.value"
      :recovery="editor.recovery.value"
      :previous-recoveries="editor.previousRecoveries.value"
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
useSeoMeta({ title: '编辑友链', robots: 'noindex, nofollow' })
const editor = useAdminLinkEditor(Number(useRoute().params.id))
</script>
