<!-- @file MaintenanceImportJob.vue @description 内容导入票据：预览或结果标题、计划、站点与图库设置预览、执行结果，以及确认执行与重新预览。 -->
<template>
  <section :aria-label="t('admin-system.maintenance.job.label')">
    <h2>
      {{
        job.completed ? t('admin-system.maintenance.job.resultTitle') : t('admin-system.maintenance.job.previewTitle')
      }}
    </h2>
    <p>
      {{
        t('admin-system.maintenance.job.ticketLine', {
          ticket: job.ticket,
          strategy: t(
            job.strategy === 'skip'
              ? 'admin-system.maintenance.job.strategySkip'
              : 'admin-system.maintenance.job.strategyCopy',
          ),
          settings: t(
            job.includeSettings
              ? 'admin-system.maintenance.job.settingsIncluded'
              : 'admin-system.maintenance.job.settingsKept',
          ),
        })
      }}
    </p>
    <AdminMaintenanceImportPlan :job="job" />
    <AdminSiteSettingsPreview
      v-if="job.settingsPreview && !job.completed"
      :value="job.settingsPreview"
      :label="t('admin-system.maintenance.job.settingsPreview')"
    />
    <section
      v-if="job.gallerySettingsPreview && !job.completed"
      :aria-label="t('admin-system.maintenance.job.gearPreview')"
    >
      <h3>{{ t('admin-system.maintenance.job.gearPreview') }}</h3>
      <GalleryGearCard :gear="job.gallerySettingsPreview.gear" />
    </section>
    <section
      v-if="job.linkSettingsPreview && !job.completed"
      :aria-label="t('admin-system.maintenance.job.linkRulesPreview')"
    >
      <LinkRules :rules="job.linkSettingsPreview.rules" />
    </section>
    <AdminMaintenanceImportResult v-if="job.result" :result="job.result" />
    <template v-if="!job.completed && !job.expired">
      <p>
        {{ t('admin-system.maintenance.job.expiresAt', { time: formatDateTime(job.expiresAt, { hour12: false }) }) }}
      </p>
      <label class="maintenance__field"
        >{{ t('admin-system.maintenance.job.acknowledge', { phrase: t(IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY) })
        }}<input v-model="acknowledgement" :disabled="pending" autocomplete="off"
      /></label>
      <div class="maintenance__actions">
        <button
          type="button"
          :disabled="pending || !job.plan.ready || !importAcknowledgement(acknowledgement, t)"
          @click="emit('execute')"
        >
          {{ t('admin-system.maintenance.job.execute') }}
        </button>
        <button type="button" :disabled="pending" @click="emit('repreview')">
          {{ t('admin-system.maintenance.job.repreview') }}
        </button>
      </div>
    </template>
    <button type="button" :disabled="pending" @click="emit('read')">
      {{ t('admin-system.maintenance.job.readResult') }}
    </button>
  </section>
</template>
<script setup lang="ts">
import { IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY, importAcknowledgement } from '~/features/backup/types'
import type { ContentImportView } from '~/features/backup/types'
import { formatDateTime } from '~/utils/format'

defineProps<{ job: ContentImportView; pending: boolean }>()
const acknowledgement = defineModel<string>('acknowledgement', { required: true })
const emit = defineEmits<{ execute: []; repreview: []; read: [] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
