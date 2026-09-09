<!-- @file [id].vue @description 朋友圈动态编辑入口，页面持有业务状态 -->
<template>
  <section>
    <ClientOnly>
      <AdminMomentForm
        :id="editor.id.value"
        :value="editor.form"
        :ready="editor.ready.value"
        :loading="editor.loading.value"
        :saving="editor.saving.value"
        :dirty="editor.dirty.value"
        :saved="editor.saved.value"
        :server-version="editor.serverVersion.value"
        :article-choices="editor.articleChoices.value"
        :articles-pending="editor.articlesPending.value"
        :articles-error="editor.articlesError.value"
        :recovery="editor.recovery.value"
        :error="editor.error.value"
        :notice="editor.notice.value"
        :local-error="editor.localError.value"
        @search-articles="editor.searchArticles"
        @change="editor.change"
        @save="editor.save"
        @reload="editor.reload"
        @restore="editor.restoreRecovery"
        @discard="editor.discardRecovery"
        @persist="editor.persistLocal"
      />
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const editor = useAdminMomentEditor(String(useRoute().params.id))
useSeoMeta({ title: () => (editor.id.value ? '编辑动态' : '发布动态'), robots: 'noindex, nofollow' })
</script>
