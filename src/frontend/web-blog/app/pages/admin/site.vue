<!--
  @file site.vue
  @description 站点公开资料、导航与页脚编辑、预览、失败保留和历史恢复；支持 Ctrl/⌘+S 保存。
-->
<template>
  <section class="admin-site">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-system.site.page.title') }}</h1>
        <p>{{ t('admin-system.site.page.intro') }}</p>
        <p>{{ t('admin-system.site.page.siteUrl', { url: siteUrl }) }}</p>
      </div>
    </header>
    <p v-if="pending" role="status">{{ t('admin-system.site.page.processing') }}</p>
    <p v-if="error" role="alert">
      {{ error }}
      <button v-if="!draft" type="button" :disabled="pending" @click="load">
        {{ t('admin-system.site.page.retryLoad') }}
      </button>
    </p>
    <ClientOnly>
      <template v-if="draft">
        <p v-if="submission" role="status">
          {{ t('admin-system.site.page.submissionPending') }}
          <button type="button" :disabled="pending || !ready" @click="checkSubmission">
            {{ t('admin-system.site.page.checkSubmission') }}
          </button>
        </p>
        <p>
          {{
            t('admin-system.site.page.revisionInfo', {
              revision: draft.revision,
              time: formatDateTime(draft.updatedAt, { hour12: false }),
            })
          }}{{ dirty ? t('admin-system.site.page.dirtySuffix') : '' }}
        </p>
        <form ref="editorForm" @submit.prevent="submit">
          <AdminSiteProfileFields v-model="draft" :disabled="pending || !ready" @pick="pickerOpen = true" />
          <AdminSiteSocialFields v-model="draft.socials" :disabled="pending || !ready" />
          <AdminSiteSeoFields v-model="draft" :disabled="pending || !ready" />
          <AdminSiteNavigationFields v-model="draft" :disabled="pending || !ready" />
          <AdminAboutSettingsFields v-if="draft.about" v-model="draft.about" :disabled="pending || !ready" />
          <AdminSiteSettingsPreview :value="draft" :label="t('admin-system.site.page.previewLabel')" />
          <AdminActionBar
            ><CommonTooltip :content="t('admin-system.site.page.saveTooltip', { shortcut: saveShortcut })"
              ><button
                :aria-busy="pending"
                type="submit"
                aria-keyshortcuts="Control+S Meta+S"
                :disabled="pending || !ready || !dirty || !!submission || !!conflict"
              >
                {{ pending ? t('admin-system.site.page.saving') : t('admin-system.site.page.save') }}
              </button></CommonTooltip
            ></AdminActionBar
          >
        </form>
        <section v-if="conflict" :aria-label="t('admin-system.site.page.conflictLabel')">
          <AdminSiteSettingsPreview :value="conflict" :label="t('admin-system.site.page.latestPreview')" /><button
            type="button"
            :disabled="pending || !ready || !!submission"
            @click="mergeConflict"
          >
            {{ t('admin-system.site.page.mergeConflict') }}
          </button>
        </section>
        <p v-if="preserved">
          {{ t('admin-system.site.page.preserved')
          }}<button type="button" :disabled="pending || !ready || !!submission" @click="recoverPreserved">
            {{ t('admin-system.site.page.recoverPreserved') }}
          </button>
        </p>
        <AdminSiteHistory
          :history="history"
          :history-page="historyPage"
          :history-total="historyTotal"
          :history-pending="historyPending"
          :history-error="historyError"
          :historical="historical"
          :pending="pending"
          :ready="ready"
          :submission="submission"
          @load="loadHistory"
          @inspect="inspect"
          @load-historical="loadHistorical"
          @restore-historical="restoreHistorical"
        />
        <AdminMediaPicker v-model:open="pickerOpen" @selected="selectAvatar" />
      </template>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { siteExtrasErrors } from '~/features/site/extras'
import type { MediaAsset } from '~/features/media/types'
import { formatDateTime } from '~/utils/format'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.site.page.title'), robots: 'noindex, nofollow' })
const siteUrl = useRuntimeConfig().public.siteUrl
const {
  draft,
  ready,
  conflict,
  historical,
  preserved,
  submission,
  checkSubmission,
  pending,
  error,
  dirty,
  history,
  historyPage,
  historyTotal,
  historyPending,
  historyError,
  load,
  save,
  loadHistory,
  inspect,
  loadHistorical,
  restoreHistorical,
  mergeConflict,
  recoverPreserved,
} = useSiteSettingsEditor()
const pickerOpen = ref(false)
const editorForm = ref<HTMLFormElement | null>(null)
const { label: saveShortcut } = useAdminSaveShortcut({ form: editorForm, dirty: () => dirty.value })
/** 导航与页脚有即时校验错误时不提交，焦点移到第一个错误输入框 */
function submit() {
  if (draft.value && Object.keys(siteExtrasErrors(draft.value, t)).length) {
    editorForm.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    error.value = t('admin-system.site.page.extrasInvalid')
    return
  }
  save()
}
function selectAvatar(asset: MediaAsset) {
  if (draft.value) {
    draft.value.avatar = asset.url
    draft.value.avatarAlt = asset.alt
  }
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-site' as site;

@include site.page;
</style>
