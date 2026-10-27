<!-- @file MaintenanceRecentImports.vue @description 备份与维护页的最近导入记录：按票据查询预览或结果。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.recent.title')">
    <h2>{{ t('admin-system.maintenance.recent.title') }}</h2>
    <p v-if="recentError" role="alert">
      {{ recentError }}
      <button type="button" @click="emit('retry')">{{ t('admin-system.maintenance.recent.retry') }}</button>
    </p>
    <p v-else-if="!recent.length">{{ t('admin-system.maintenance.recent.empty') }}</p>
    <ul>
      <li v-for="item in recent" :key="item.ticket">
        <button type="button" :disabled="pending" @click="emit('read', item.ticket)">
          {{ formatDateTime(item.createdAt, { hour12: false }) }} ·
          {{
            t(
              item.completed
                ? 'admin-system.maintenance.recent.completed'
                : item.expired
                  ? 'admin-system.maintenance.recent.expired'
                  : 'admin-system.maintenance.recent.running',
            )
          }}
        </button>
      </li>
    </ul>
  </section>
</template>
<script setup lang="ts">
import type { BackupRecentItem } from '~/features/backup/backupSession'
import { formatDateTime } from '~/utils/format'

defineProps<{ pending: boolean; recent: BackupRecentItem[]; recentError: string }>()
const emit = defineEmits<{ retry: []; read: [ticket: string] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
