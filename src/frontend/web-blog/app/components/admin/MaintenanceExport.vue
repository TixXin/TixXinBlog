<!-- @file MaintenanceExport.vue @description 备份与维护页的内容包下载：媒体范围选择与下载按钮。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.export.title')">
    <h2>{{ t('admin-system.maintenance.export.title') }}</h2>
    <p>{{ t('admin-system.maintenance.export.scope') }}</p>
    <p>{{ t('admin-system.maintenance.export.excluded') }}</p>
    <label
      ><input v-model="mediaIncluded" type="checkbox" :disabled="pending" />{{
        t('admin-system.maintenance.export.includeMedia')
      }}</label
    >
    <p>
      {{
        mediaIncluded
          ? t('admin-system.maintenance.export.withMedia')
          : t('admin-system.maintenance.export.withoutMedia')
      }}
    </p>
    <button type="button" :disabled="pending" @click="emit('export')">
      {{ t('admin-system.maintenance.export.download') }}
    </button>
  </section>
</template>
<script setup lang="ts">
defineProps<{ pending: boolean }>()
const mediaIncluded = defineModel<boolean>('mediaIncluded', { required: true })
const emit = defineEmits<{ export: [] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
