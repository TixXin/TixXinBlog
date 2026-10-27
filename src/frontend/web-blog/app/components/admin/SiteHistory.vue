<!--
  @file SiteHistory.vue
  @description 站点设置的历史版本：分页列表、查看某一版本的预览，载入编辑或直接恢复
-->
<template>
  <section class="admin-site__history" :aria-label="t('admin-system.site.page.historyLabel')">
    <h2>{{ t('admin-system.site.page.historyTitle') }}</h2>
    <p>{{ t('admin-system.site.page.historyIntro') }}</p>
    <p v-if="historyError" role="alert">
      {{ historyError }}
      <button type="button" :disabled="historyPending" @click="emit('load')">
        {{ t('admin-system.site.page.retryHistory') }}
      </button>
    </p>
    <ul>
      <li v-for="item in history" :key="item.revision">
        <button type="button" :disabled="historyPending || pending" @click="emit('inspect', item.revision)">
          {{
            t('admin-system.site.page.viewRevision', {
              revision: item.revision,
              reason: item.reason,
              time: formatDateTime(item.createdAt, { hour12: false }),
            })
          }}
        </button>
      </li>
    </ul>
    <button type="button" :disabled="historyPending || historyPage <= 1" @click="emit('load', historyPage - 1)">
      {{ t('admin-system.site.page.prevHistory') }}</button
    ><span> {{ historyPage }} / {{ Math.max(1, Math.ceil(historyTotal / 20)) }} </span
    ><button
      type="button"
      :disabled="historyPending || historyPage * 20 >= historyTotal"
      @click="emit('load', historyPage + 1)"
    >
      {{ t('admin-system.site.page.nextHistory') }}
    </button>
    <template v-if="historical"
      ><AdminSiteSettingsPreview
        :value="historical"
        :label="t('admin-system.site.page.historicalPreview', { revision: historical.revision })"
      /><button type="button" :disabled="pending || !ready || !!submission" @click="emit('loadHistorical')">
        {{ t('admin-system.site.page.loadHistorical') }}</button
      ><button type="button" :disabled="pending || !ready || !!submission" @click="emit('restoreHistorical')">
        {{ t('admin-system.site.page.restoreHistorical') }}
      </button></template
    >
  </section>
</template>
<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import type { SiteRevisionItem } from '~/features/site/editorSession'
import { formatDateTime } from '~/utils/format'

defineProps<{
  history: SiteRevisionItem[]
  historyPage: number
  historyTotal: number
  historyPending: boolean
  historyError: string
  historical: SiteSettingsData | null
  pending: boolean
  ready: boolean
  submission: unknown
}>()
const emit = defineEmits<{
  load: [page?: number]
  inspect: [revision: number]
  loadHistorical: []
  restoreHistorical: []
}>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-site' as site;

@include site.page;
</style>
