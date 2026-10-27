<!--
  @file maintenance.vue
  @description 内容包下载和安全迁入，明确媒体范围、冲突策略与持久化操作结果。
-->
<template>
  <section class="maintenance">
    <header class="admin-page-header">
      <h1>{{ t('admin-system.maintenance.title') }}</h1>
    </header>
    <ClientOnly>
      <AdminMaintenanceDiagnostics
        :pending="diagnostics.pending.value"
        :error="diagnostics.error.value"
        :data="diagnostics.data.value"
        :media="diagnostics.media.value"
        @load="diagnostics.load"
        @check-media="diagnostics.checkMedia"
      />
      <AdminMaintenanceFullBackup />
      <AdminMaintenanceExport v-model:media-included="mediaIncluded" :pending="pending" @export="exportPackage" />
      <AdminMaintenanceImportForm
        v-model:strategy="strategy"
        v-model:include-settings="includeSettings"
        :pending="pending"
        :file="file"
        :request-id="requestId"
        @choose="choose"
        @preview="preview"
        @read="read"
      />
      <p v-if="pending" role="status">{{ t('admin-system.maintenance.processing') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <AdminMaintenanceImportJob
        v-if="job"
        v-model:acknowledgement="acknowledgement"
        :job="job"
        :pending="pending"
        @execute="execute"
        @repreview="repreview"
        @read="read()"
      />
      <AdminMaintenanceRecentImports
        :pending="pending"
        :recent="recent"
        :recent-error="recentError"
        @retry="loadRecent"
        @read="read"
      />
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: '/admin/maintenance' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.maintenance.title'), robots: 'noindex, nofollow' })
const {
  pending,
  error,
  mediaIncluded,
  file,
  strategy,
  includeSettings,
  requestId,
  job,
  acknowledgement,
  recent,
  recentError,
  exportPackage,
  choose,
  preview,
  read,
  repreview,
  execute,
  loadRecent,
} = useContentBackup()
const diagnostics = useMaintenanceDiagnostics()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
