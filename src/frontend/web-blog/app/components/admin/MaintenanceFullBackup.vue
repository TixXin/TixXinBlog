<!-- @file MaintenanceFullBackup.vue @description 备份与维护页的完整备份说明：生成、校验与恢复命令。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.fullBackup.title')">
    <h2>{{ t('admin-system.maintenance.fullBackup.title') }}</h2>
    <p>{{ t('admin-system.maintenance.fullBackup.intro') }}</p>
    <p>{{ t('admin-system.maintenance.fullBackup.generateHint') }}</p>
    <pre><code>corepack pnpm --filter server-main run backup:full</code></pre>
    <p>{{ t('admin-system.maintenance.fullBackup.verifyHint') }}</p>
    <pre><code>corepack pnpm --filter server-main run backup:verify --directory &lt;{{ t('admin-system.maintenance.fullBackup.directory') }}&gt;
corepack pnpm --filter server-main run backup:restore --directory &lt;{{ t('admin-system.maintenance.fullBackup.directory') }}&gt;</code></pre>
    <p>{{ t('admin-system.maintenance.fullBackup.afterRestore') }}</p>
  </section>
</template>
<script setup lang="ts">
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
