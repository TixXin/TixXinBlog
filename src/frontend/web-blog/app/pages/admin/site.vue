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
          <fieldset class="admin-site__grid" :disabled="pending || !ready">
            <legend>{{ t('admin-system.site.page.profileLegend') }}</legend>
            <label
              >{{ t('admin-system.site.editor.fields.name') }}<input v-model="draft.name" maxlength="80" required
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.description')
              }}<textarea v-model="draft.description" maxlength="300" rows="3" />
            </label>
            <label
              >{{ t('admin-system.site.editor.fields.ownerName')
              }}<input v-model="draft.ownerName" maxlength="80" required
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.ownerTitle') }}<input v-model="draft.ownerTitle" maxlength="200"
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.avatar') }}<input v-model="draft.avatar" maxlength="1000"
            /></label>
            <button type="button" class="admin-site__pick" @click="pickerOpen = true">
              <Icon name="lucide:image" aria-hidden="true" />{{ t('admin-system.site.page.pickAvatar') }}
            </button>
            <label
              >{{ t('admin-system.site.editor.fields.avatarAlt') }}<input v-model="draft.avatarAlt" maxlength="300"
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.presenceLabel')
              }}<input
                v-model="draft.presenceLabel"
                maxlength="20"
                :placeholder="t('admin-system.site.page.presenceLabelPlaceholder')"
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.presenceSignature')
              }}<input
                v-model="draft.presenceSignature"
                maxlength="60"
                :placeholder="t('admin-system.site.page.presenceSignaturePlaceholder')"
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.presenceStatus')
              }}<select v-model="draft.presenceStatus">
                <option v-for="option in presenceStatusOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select></label
            >
            <label
              >{{ t('admin-system.site.editor.fields.launchedAt')
              }}<CommonDatePicker
                v-model="draft.launchedAt"
                :placeholder="t('admin-system.site.page.launchedAtPlaceholder')"
                clearable
            /></label>
          </fieldset>
          <AdminSiteSocialFields v-model="draft.socials" :disabled="pending || !ready" />
          <fieldset :disabled="pending || !ready">
            <legend>{{ t('admin-system.site.page.seoLegend') }}</legend>
            <label
              >{{ t('admin-system.site.editor.fields.announcement')
              }}<textarea
                v-model="draft.announcement"
                maxlength="1000"
                rows="4"
                :placeholder="t('admin-system.site.page.announcementPlaceholder')"
              />
            </label>
            <label
              >{{ t('admin-system.site.editor.fields.seoTitle')
              }}<input
                v-model="draft.seoTitle"
                maxlength="160"
                :placeholder="t('admin-system.site.page.seoTitlePlaceholder')"
            /></label>
            <label
              >{{ t('admin-system.site.editor.fields.seoDescription')
              }}<textarea
                v-model="draft.seoDescription"
                maxlength="320"
                rows="3"
                :placeholder="t('admin-system.site.page.seoDescriptionPlaceholder')"
              />
            </label>
            <label class="admin-site__check"
              ><input
                v-model="draft.searchIndexing"
                class="admin-switch"
                type="checkbox"
                aria-describedby="admin-site-indexing-hint"
              />{{ t('admin-system.site.page.searchIndexing') }}</label
            >
            <p id="admin-site-indexing-hint" class="admin-site__hint">
              {{ t('admin-system.site.page.searchIndexingHint') }}
            </p>
          </fieldset>
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
        <section class="admin-site__history" :aria-label="t('admin-system.site.page.historyLabel')">
          <h2>{{ t('admin-system.site.page.historyTitle') }}</h2>
          <p>{{ t('admin-system.site.page.historyIntro') }}</p>
          <p v-if="historyError" role="alert">
            {{ historyError }}
            <button type="button" :disabled="historyPending" @click="loadHistory()">
              {{ t('admin-system.site.page.retryHistory') }}
            </button>
          </p>
          <ul>
            <li v-for="item in history" :key="item.revision">
              <button type="button" :disabled="historyPending || pending" @click="inspect(item.revision)">
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
          <button type="button" :disabled="historyPending || historyPage <= 1" @click="loadHistory(historyPage - 1)">
            {{ t('admin-system.site.page.prevHistory') }}</button
          ><span> {{ historyPage }} / {{ Math.max(1, Math.ceil(historyTotal / 20)) }} </span
          ><button
            type="button"
            :disabled="historyPending || historyPage * 20 >= historyTotal"
            @click="loadHistory(historyPage + 1)"
          >
            {{ t('admin-system.site.page.nextHistory') }}
          </button>
          <template v-if="historical"
            ><AdminSiteSettingsPreview
              :value="historical"
              :label="t('admin-system.site.page.historicalPreview', { revision: historical.revision })"
            /><button type="button" :disabled="pending || !ready || !!submission" @click="loadHistorical">
              {{ t('admin-system.site.page.loadHistorical') }}</button
            ><button type="button" :disabled="pending || !ready || !!submission" @click="restoreHistorical">
              {{ t('admin-system.site.page.restoreHistorical') }}
            </button></template
          >
        </section>
        <AdminMediaPicker v-model:open="pickerOpen" @selected="selectAvatar" />
      </template>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { presenceStatusOptions } from '~/features/site/settings'
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
.admin-site {
  min-width: 0;
  overflow-wrap: anywhere;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}
p {
  margin-block: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
// 每组设置是一张卡片；legend 浮动后留在卡片内作为标题
fieldset {
  min-width: 0;
  margin: 0 0 var(--admin-gap);
  padding: 1.25rem 1.25rem 0.5rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
}
legend {
  float: left;
  width: 100%;
  margin: 0 0 1rem;
  padding: 0;
  font-size: 1rem;
  font-weight: 600;
}
legend + * {
  clear: both;
}
label {
  display: grid;
  gap: 0.375rem;
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
}
// 资料区两列，多行文本与标题占满整行
.admin-site__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1rem;

  > legend,
  > label:has(textarea) {
    grid-column: 1 / -1;
  }
}
.admin-site__pick {
  align-self: end;
  justify-self: start;
  margin-bottom: 1rem;
}
.admin-site__check {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.25rem;
  color: var(--text-main);
}
.admin-site__hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
}
.admin-site__history {
  margin-block: 1.5rem;
}
ul {
  padding: 0;
  list-style: none;
}
@media (max-width: 760px) {
  .admin-site__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
