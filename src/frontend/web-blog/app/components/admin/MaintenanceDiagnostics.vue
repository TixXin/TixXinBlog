<!-- @file MaintenanceDiagnostics.vue @description 备份与维护页的运行诊断：数据库、迁移、存储与运行环境，以及现有媒体文件核验结果。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.diagnostics.title')">
    <h2>{{ t('admin-system.maintenance.diagnostics.title') }}</h2>
    <p>{{ t('admin-system.maintenance.diagnostics.intro') }}</p>
    <div class="maintenance__actions">
      <button type="button" :disabled="pending" @click="emit('load')">
        {{ t('admin-system.maintenance.diagnostics.refresh') }}
      </button>
      <button type="button" :disabled="pending" @click="emit('checkMedia')">
        {{ t('admin-system.maintenance.diagnostics.checkMedia') }}
      </button>
    </div>
    <p v-if="pending" role="status">{{ t('admin-system.maintenance.diagnostics.checking') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul v-if="data">
      <li>
        {{
          t('admin-system.maintenance.diagnostics.database', {
            state: t(
              data.databaseReachable
                ? 'admin-system.maintenance.diagnostics.available'
                : 'admin-system.maintenance.diagnostics.unavailable',
            ),
          })
        }}
      </li>
      <li>
        {{
          t('admin-system.maintenance.diagnostics.migrations', {
            count: data.pendingMigrations,
            drift: t(
              data.schemaDrift
                ? 'admin-system.maintenance.diagnostics.schemaDrifted'
                : 'admin-system.maintenance.diagnostics.schemaAligned',
            ),
          })
        }}
      </li>
      <li>
        {{
          t('admin-system.maintenance.diagnostics.storage', {
            state: t(
              data.storage.readable && data.storage.writable && data.storage.cleaned
                ? 'admin-system.maintenance.diagnostics.storagePassed'
                : 'admin-system.maintenance.diagnostics.storageFailed',
            ),
            count: data.mediaRecords,
          })
        }}
      </li>
      <li>
        {{
          t('admin-system.maintenance.diagnostics.runtime', {
            environment: data.runtime.environment,
            node: data.runtime.node,
            unsupported: data.runtime.nodeSupported ? '' : t('admin-system.maintenance.diagnostics.nodeUnsupported'),
          })
        }}
      </li>
    </ul>
    <template v-if="media"
      ><p role="status">
        {{
          t('admin-system.maintenance.diagnostics.mediaSummary', {
            checked: media.checked,
            problems: media.problems.length,
          })
        }}
      </p>
      <ul>
        <li v-for="item in media.problems" :key="item.id">
          <NuxtLink :to="`/admin/media?search=${item.id}&deleted=${item.deleted}`">{{ item.id }}</NuxtLink> ·
          {{ item.reason }}
        </li>
      </ul></template
    >
  </section>
</template>
<script setup lang="ts">
import type { MaintenanceDiagnostics, MaintenanceMediaCheck } from '~/composables/useMaintenanceDiagnostics'

defineProps<{
  pending: boolean
  error: string
  data: MaintenanceDiagnostics | null
  media: MaintenanceMediaCheck | null
}>()
const emit = defineEmits<{ load: []; checkMedia: [] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
