<!-- @file settings.vue @description 图库器材资料维护，不由作品统计或上传文件推测设备 -->
<template>
  <section class="gallery-settings">
    <h1>{{ $t('admin-media.gallerySettings.title') }}</h1>
    <AdminBackLink to="/admin/gallery">{{ $t('admin-media.gallerySettings.back') }}</AdminBackLink>
    <p>{{ $t('admin-media.gallerySettings.intro') }}</p>
    <ClientOnly
      ><CommonRequestFeedback
        v-if="pending || error"
        :pending="pending"
        :title="error || $t('admin-media.gallerySettings.loading')"
        :compact="!!draft"
        @retry="load"
      />
      <p v-if="notice" role="status">{{ notice }}</p>
      <section v-if="recovery" :aria-label="$t('admin-media.gallerySettings.recoveryLabel')">
        <p>{{ $t('admin-media.gallerySettings.recoveryFound') }}</p>
        <button type="button" :disabled="pending || !ready" @click="restore">
          {{ $t('admin-media.gallerySettings.restore') }}
        </button>
      </section>
      <section v-if="previousRecoveries.length" :aria-label="$t('admin-media.gallerySettings.previousLabel')">
        <h2>{{ $t('admin-media.gallerySettings.previousTitle') }}</h2>
        <p>{{ $t('admin-media.gallerySettings.previousBody') }}</p>
        <GalleryGearCard v-for="item in previousRecoveries" :key="item.key" :gear="item.gear" />
      </section>
      <form v-if="draft" ref="editorForm" @submit.prevent="save">
        <fieldset :disabled="pending || !ready">
          <legend>{{ $t('admin-media.gallerySettings.listLegend') }}</legend>
          <div v-for="(item, index) in draft.gear" :key="index" class="gallery-settings__item">
            <label
              >{{ $t('admin-media.gallerySettings.name')
              }}<input
                v-model="item.name"
                :aria-label="$t('admin-media.gallerySettings.nameAt', { index: index + 1 })"
                required
                maxlength="80" /></label
            ><label
              >{{ $t('admin-media.gallerySettings.description')
              }}<textarea
                v-model="item.description"
                :aria-label="$t('admin-media.gallerySettings.descriptionAt', { index: index + 1 })"
                maxlength="300"
                rows="2"
              /></label
            ><label
              >{{ $t('admin-media.gallerySettings.icon')
              }}<select v-model="item.icon">
                <option value="lucide:camera">{{ $t('admin-media.gallerySettings.iconCamera') }}</option>
                <option value="lucide:circle">{{ $t('admin-media.gallerySettings.iconLens') }}</option>
                <option value="lucide:smartphone">{{ $t('admin-media.gallerySettings.iconPhone') }}</option>
              </select></label
            ><button
              type="button"
              :aria-label="$t('admin-media.gallerySettings.removeAt', { index: index + 1 })"
              @click="draft.gear.splice(index, 1)"
            >
              {{ $t('admin-media.gallerySettings.remove') }}
            </button>
          </div>
          <button
            type="button"
            :disabled="draft.gear.length >= 12"
            @click="draft.gear.push({ name: '', description: '', icon: 'lucide:camera' })"
          >
            {{ $t('admin-media.gallerySettings.add') }}
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
              {{ $t('admin-media.gallerySettings.save') }}
            </button></CommonTooltip
          ></AdminActionBar
        >
        <p>
          {{ $t('admin-media.gallerySettings.revision', { revision: draft.revision })
          }}{{ dirty ? $t('admin-media.gallerySettings.unsaved') : '' }}
        </p>
      </form>
      <section v-if="conflict" :aria-label="$t('admin-media.gallerySettings.conflictLabel')">
        <h2>{{ $t('admin-media.gallerySettings.conflictTitle') }}</h2>
        <GalleryGearCard :gear="conflict.gear" /><button type="button" :disabled="pending" @click="merge">
          {{ $t('admin-media.gallerySettings.merge') }}
        </button>
      </section>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-media.gallerySettings.title'), robots: 'noindex, nofollow' })
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
} = useGallerySettingsEditor()
</script>
<style scoped lang="scss">
.gallery-settings {
  max-width: 850px;
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
a {
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
input,
textarea,
select,
button {
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  color: var(--text-main);
  background: var(--surface-2);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
button:disabled {
  opacity: 0.5;
}
.gallery-settings__item {
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}
</style>
