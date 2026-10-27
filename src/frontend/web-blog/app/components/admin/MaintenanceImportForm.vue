<!-- @file MaintenanceImportForm.vue @description 备份与维护页的内容包选择：文件、冲突策略、站点设置范围与生成预览。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.import.choosePackage')">
    <h2>{{ t('admin-system.maintenance.import.title') }}</h2>
    <p>{{ t('admin-system.maintenance.import.formats') }}</p>
    <p>{{ t('admin-system.maintenance.import.guestbookNote') }}</p>
    <label class="maintenance__field"
      >{{ t('admin-system.maintenance.import.choosePackage')
      }}<input type="file" accept="application/json,.json" :disabled="pending" @change="chooseFile"
    /></label>
    <p v-if="file">
      {{ t('admin-system.maintenance.import.selectedFile', { name: file.name, size: (file.size / 1024).toFixed(1) }) }}
    </p>
    <label class="maintenance__field"
      >{{ t('admin-system.maintenance.import.strategy')
      }}<select v-model="strategy" :disabled="pending">
        <option value="skip">{{ t('admin-system.maintenance.import.strategySkip') }}</option>
        <option value="copy">{{ t('admin-system.maintenance.import.strategyCopy') }}</option>
      </select></label
    >
    <label
      ><input v-model="includeSettings" type="checkbox" :disabled="pending" />{{
        t('admin-system.maintenance.import.includeSettings')
      }}</label
    >
    <p>{{ t('admin-system.maintenance.import.duplicateRule') }}</p>
    <p>{{ t('admin-system.maintenance.import.linkRule') }}</p>
    <div class="maintenance__actions">
      <button type="button" :disabled="pending || !file" @click="emit('preview')">
        {{ t('admin-system.maintenance.import.preview') }}
      </button>
      <button v-if="requestId" type="button" :disabled="pending" @click="emit('read', requestId)">
        {{ t('admin-system.maintenance.import.queryTicket') }}
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
defineProps<{ pending: boolean; file: File | null; requestId: string }>()
const strategy = defineModel<'skip' | 'copy'>('strategy', { required: true })
const includeSettings = defineModel<boolean>('includeSettings', { required: true })
const emit = defineEmits<{ choose: [file: File | null]; preview: []; read: [ticket: string] }>()
const { t } = useI18n()
function chooseFile(event: Event) {
  emit('choose', (event.target as HTMLInputElement).files?.[0] ?? null)
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
