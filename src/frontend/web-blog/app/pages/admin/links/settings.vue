<!-- @file settings.vue @description 友链须知公开配置，维护规则及完整恢复副本 -->
<template>
  <section class="link-settings">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-media.linkSettings.title') }}</h1>
      </div>
    </header>
    <AdminBackLink to="/admin/links">{{ $t('admin-media.linkSettings.back') }}</AdminBackLink>
    <p>{{ $t('admin-media.linkSettings.intro') }}</p>
    <ClientOnly
      ><CommonRequestFeedback
        v-if="pending || error"
        :pending="pending"
        :title="error || $t('admin-media.linkSettings.loading')"
        :compact="!!draft"
        @retry="load"
      />
      <p v-if="notice" role="status">{{ notice }}</p>
      <section v-if="recovery" :aria-label="$t('admin-media.linkSettings.recoveryLabel')">
        <h2>{{ $t('admin-media.linkSettings.recoveryTitle') }}</h2>
        <LinkRules :rules="recovery.rules" /><button type="button" :disabled="pending || !ready" @click="restore">
          {{ $t('admin-media.linkSettings.restore') }}
        </button>
      </section>
      <section v-if="previousRecoveries.length" :aria-label="$t('admin-media.linkSettings.previousLabel')">
        <h2>{{ $t('admin-media.linkSettings.previousTitle') }}</h2>
        <p>{{ $t('admin-media.linkSettings.previousBody') }}</p>
        <LinkRules v-for="copy in previousRecoveries" :key="copy.key" :rules="copy.value.rules" />
      </section>
      <form v-if="draft" ref="editorForm" @submit.prevent="save">
        <fieldset :disabled="pending || !ready">
          <legend>{{ $t('admin-media.linkSettings.listLegend') }}</legend>
          <div v-for="(rule, index) in draft.rules" :key="index">
            <label
              >{{ $t('admin-media.linkSettings.ruleAt', { index: index + 1 })
              }}<textarea
                v-model="draft.rules[index]"
                :aria-label="$t('admin-media.linkSettings.ruleLabelAt', { index: index + 1 })"
                rows="3"
                required
                maxlength="300"
              /></label
            ><button
              type="button"
              :aria-label="$t('admin-media.linkSettings.removeAt', { index: index + 1 })"
              @click="draft.rules.splice(index, 1)"
            >
              {{ $t('admin-media.linkSettings.remove') }}
            </button>
          </div>
          <button type="button" :disabled="draft.rules.length >= 12" @click="draft.rules.push('')">
            {{ $t('admin-media.linkSettings.add') }}
          </button>
        </fieldset>
        <AdminActionBar
          ><CommonTooltip :content="$t('admin-media.gallerySettings.saveTooltip', { shortcut: saveShortcut })"
            ><button
              :aria-busy="pending"
              type="submit"
              aria-keyshortcuts="Control+S Meta+S"
              :disabled="pending || !ready || !dirty"
            >
              {{ $t('admin-media.linkSettings.save') }}
            </button></CommonTooltip
          ></AdminActionBar
        >
        <p>
          {{ $t('admin-media.gallerySettings.revision', { revision: draft.revision })
          }}{{ dirty ? $t('admin-media.gallerySettings.unsaved') : '' }}
        </p>
      </form>
      <section v-if="conflict" :aria-label="$t('admin-media.linkSettings.conflictLabel')">
        <h2>{{ $t('admin-media.linkSettings.conflictTitle') }}</h2>
        <LinkRules :rules="conflict.rules" /><button type="button" :disabled="pending" @click="merge">
          {{ $t('admin-media.gallerySettings.merge') }}
        </button>
      </section></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.linkSettings.title'), robots: 'noindex, nofollow' })
const editorForm = ref<HTMLFormElement | null>(null)
// Ctrl/⌘+S 复用保存按钮提交；无修改时按钮禁用，快捷键同样不提交。
const { label: saveShortcut } = useAdminSaveShortcut({ form: editorForm })
const {
  draft,
  conflict,
  recovery,
  previousRecoveries,
  pending,
  ready,
  error,
  notice,
  dirty,
  load,
  save,
  restore,
  merge,
} = useLinkSettingsEditor()
</script>
<style scoped lang="scss">
.link-settings {
  max-width: 850px;
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
a:not(.admin-btn) {
  color: var(--accent);
}
p {
  color: var(--text-muted);
}
fieldset {
  min-width: 0;
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.5rem;
}

textarea {
  width: 100%;
}
</style>
