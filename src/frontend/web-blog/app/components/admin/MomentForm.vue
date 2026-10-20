<!-- @file MomentForm.vue @description 动态编辑展示表单，数据与保存事件由页面提供 -->
<template>
  <form ref="editorForm" class="moment-editor" @submit.prevent="$emit('save', value.status)">
    <header class="moment-editor__heading">
      <h1>{{ id ? $t('admin-content.momentForm.editTitle') : $t('admin-content.momentForm.createTitle') }}</h1>
      <AdminBackLink to="/admin/moments">{{ $t('admin-content.momentForm.back') }}</AdminBackLink>
      <NuxtLink v-if="id && saved?.status === 'published'" :to="`/moments/${id}`">{{
        $t('admin-content.momentForm.viewPublic')
      }}</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="saving || loading" @click="$emit('reload')">
        {{ $t('admin-content.momentForm.reload') }}
      </button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }}
      <button type="button" @click="$emit('persist')">{{ $t('admin-content.momentForm.retryPersist') }}</button>
    </p>
    <section v-if="recovery" class="moment-editor__recovery" :aria-label="$t('admin-content.momentForm.recoveryLabel')">
      <h2>{{ $t('admin-content.momentForm.recoveryTitle') }}</h2>
      <p>{{ recovery.form.content.slice(0, 160) }}</p>
      <button type="button" :disabled="saving" @click="$emit('restore')">
        {{ $t('admin-content.momentForm.restore') }}
      </button>
      <button type="button" :disabled="saving" @click="$emit('discard')">
        {{ $t('admin-content.momentForm.discard') }}
      </button>
    </section>
    <section
      v-if="serverVersion"
      class="moment-editor__recovery"
      :aria-label="$t('admin-content.momentForm.serverLabel')"
    >
      <h2>{{ $t('admin-content.momentForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
      <p>
        {{ $t(`admin-content.momentForm.status.${serverVersion.status}`) }} ·
        {{ serverVersion.topics?.join($t('admin-content.momentForm.listSeparator')) }}
      </p>
      <blockquote>{{ serverVersion.content }}</blockquote>
      <button type="button" :disabled="saving" @click="$emit('reload')">
        {{ $t('admin-content.momentForm.loadServer') }}
      </button>
    </section>
    <p v-if="loading" role="status">{{ $t('admin-content.momentForm.loading') }}</p>
    <fieldset :disabled="!ready || loading">
      <label
        >{{ $t('admin-content.momentForm.content')
        }}<textarea
          :value="value.content"
          :aria-label="$t('admin-content.momentForm.content')"
          rows="8"
          maxlength="10000"
          required
          :placeholder="$t('admin-content.momentForm.contentPlaceholder')"
          @input="change('content', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <small>{{ value.content.length }} / 10000</small>
      <label
        >{{ $t('admin-content.momentForm.topics')
        }}<input
          :value="value.topics.join($t('admin-content.momentForm.topicJoiner'))"
          :aria-label="$t('admin-content.momentForm.topicsAria')"
          @change="
            change(
              'topics',
              ($event.target as HTMLInputElement).value
                .split(/[,，]/)
                .map((v) => v.trim().replace(/^#+/, ''))
                .filter(Boolean),
            )
          "
      /></label>
      <section class="moment-editor__media" :aria-label="$t('admin-content.momentForm.imagesLabel')">
        <h2>{{ $t('admin-content.momentForm.imagesTitle', { count: value.images.length, max: 9 }) }}</h2>
        <button type="button" :disabled="value.images.length >= 9" @click="mediaOpen = true">
          {{ $t('admin-content.momentForm.pickImage') }}
        </button>
        <div class="moment-editor__images">
          <figure v-for="(url, index) in value.images" :key="url">
            <img :src="url" :alt="$t('admin-content.momentForm.imageAlt', { index: index + 1 })" />
            <button
              type="button"
              :aria-label="$t('admin-content.momentForm.removeImageAria', { index: index + 1 })"
              @click="
                change(
                  'images',
                  value.images.filter((_, i) => i !== index),
                )
              "
            >
              {{ $t('admin-content.momentForm.removeImage') }}
            </button>
          </figure>
        </div>
      </section>
      <div class="moment-editor__row">
        <label
          >{{ $t('admin-content.momentForm.location')
          }}<input
            :value="value.location"
            maxlength="160"
            @input="change('location', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.device')
          }}<input
            :value="value.device"
            maxlength="80"
            @input="change('device', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.mood')
          }}<input
            :value="value.mood"
            maxlength="80"
            @input="change('mood', ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <label
        >{{ $t('admin-content.momentForm.linkType')
        }}<select
          :value="value.linkedLink ? 'link' : value.linkedArticleId ? 'article' : linkMode"
          :aria-label="$t('admin-content.momentForm.linkTypeAria')"
          @change="setLinkMode(($event.target as HTMLSelectElement).value)"
        >
          <option value="none">{{ $t('admin-content.momentForm.linkNone') }}</option>
          <option value="article">{{ $t('admin-content.momentForm.linkArticle') }}</option>
          <option value="link">{{ $t('admin-content.momentForm.linkExternal') }}</option>
        </select></label
      >
      <section v-if="linkMode === 'article' || value.linkedArticleId">
        <label
          >{{ $t('admin-content.momentForm.articleSearch')
          }}<input
            v-model="articleSearch"
            type="search"
            :aria-label="$t('admin-content.momentForm.articleSearchAria')"
            maxlength="200"
            :placeholder="$t('admin-content.momentForm.articleSearchPlaceholder')"
            @input="$emit('search-articles', articleSearch)"
        /></label>
        <p v-if="articlesPending" role="status">{{ $t('admin-content.momentForm.articleSearching') }}</p>
        <p v-if="articlesError" role="alert">{{ articlesError }}</p>
        <label
          >{{ $t('admin-content.momentForm.article')
          }}<select
            :value="value.linkedArticleId ?? ''"
            :aria-label="$t('admin-content.momentForm.article')"
            @change="
              change(
                'linkedArticleId',
                ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null,
              )
            "
          >
            <option value="">{{ $t('admin-content.momentForm.articlePlaceholder') }}</option>
            <option v-for="post in articleChoices" :key="post.id" :value="post.id">{{ post.title }}</option>
          </select></label
        >
      </section>
      <div v-if="value.linkedLink" class="moment-editor__row">
        <label
          >{{ $t('admin-content.momentForm.linkUrl')
          }}<input
            :value="value.linkedLink.url"
            type="url"
            maxlength="2048"
            :aria-label="$t('admin-content.momentForm.linkUrlAria')"
            @input="changeLink({ url: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.linkTitle')
          }}<input
            :value="value.linkedLink.title"
            maxlength="160"
            :aria-label="$t('admin-content.momentForm.linkTitleAria')"
            @input="changeLink({ title: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.linkDescription')
          }}<input
            :value="value.linkedLink.description"
            maxlength="500"
            @input="changeLink({ description: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.linkSiteName')
          }}<input
            :value="value.linkedLink.siteName"
            maxlength="80"
            @input="changeLink({ siteName: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.linkImage')
          }}<input
            :value="value.linkedLink.image"
            maxlength="2048"
            @input="changeLink({ image: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.linkFavicon')
          }}<input
            :value="value.linkedLink.favicon"
            maxlength="2048"
            @input="changeLink({ favicon: ($event.target as HTMLInputElement).value })"
        /></label>
      </div>
      <div class="moment-editor__row">
        <label
          >{{ $t('admin-content.momentForm.saveStatus')
          }}<select
            :value="value.status"
            :aria-label="$t('admin-content.momentForm.saveStatusAria')"
            @change="change('status', ($event.target as HTMLSelectElement).value as MomentStatus)"
          >
            <option value="draft">{{ $t('admin-content.momentForm.status.draft') }}</option>
            <option value="published">{{ $t('admin-content.momentForm.status.published') }}</option>
            <option value="archived">{{ $t('admin-content.momentForm.status.archived') }}</option>
          </select></label
        >
        <label class="moment-editor__check"
          ><input
            :checked="value.isPinned"
            type="checkbox"
            @change="change('isPinned', ($event.target as HTMLInputElement).checked)"
          />{{ $t('admin-content.momentForm.pinned') }}</label
        >
      </div>
    </fieldset>
    <AdminActionBar class="moment-editor__actions">
      <CommonTooltip :content="$t('admin-content.momentForm.saveTooltip', { shortcut: saveShortcut })"
        ><button
          ref="saveButton"
          :aria-busy="saving"
          type="submit"
          aria-keyshortcuts="Control+S Meta+S"
          :disabled="!ready || loading || saving || !value.content.trim()"
        >
          {{ saving ? $t('admin-content.momentForm.saving') : $t('admin-content.momentForm.save') }}
        </button></CommonTooltip
      >
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="requestSave('draft')"
      >
        {{ $t('admin-content.momentForm.saveDraft') }}
      </button>
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="requestSave('published')"
      >
        {{ $t('admin-content.momentForm.publish') }}
      </button>
      <span>{{
        dirty
          ? $t('admin-content.momentForm.stateDirty')
          : saved
            ? $t('admin-content.momentForm.stateSaved')
            : $t('admin-content.momentForm.stateUnsaved')
      }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import type { ManagedMoment, MomentEditable, MomentLinkedLink, MomentStatus } from '~/features/moment/types'
import type { MomentRecovery } from '~/features/moment/editor'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{
  value: MomentEditable
  id: string | null
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  saved: ManagedMoment | null
  serverVersion: ManagedMoment | null
  recovery: MomentRecovery | null
  error: string
  notice: string
  localError: string
  articleChoices: { id: number; title: string }[]
  articlesPending: boolean
  articlesError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<MomentEditable>]
  save: [status: MomentStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  'search-articles': [query: string]
}>()
const editorForm = ref<HTMLFormElement | null>(null),
  saveButton = ref<HTMLButtonElement | null>(null)
// Ctrl/⌘+S 复用“保存”按钮的表单提交；按钮禁用（未就绪、保存中、校验未过）或无修改时不提交。
const { label: saveShortcut } = useAdminSaveShortcut({
  form: editorForm,
  submitter: () => saveButton.value,
  dirty: () => props.dirty,
})
const mediaOpen = ref(false),
  linkMode = ref('none'),
  articleSearch = ref('')
function requestSave(status: MomentStatus) {
  if (editorForm.value?.reportValidity()) emit('save', status)
}
function change<K extends keyof MomentEditable>(key: K, value: MomentEditable[K]) {
  emit('change', { [key]: value })
}
function changeLink(value: Partial<MomentLinkedLink>) {
  change('linkedLink', { url: '', title: '', ...props.value.linkedLink, ...value })
}
function setLinkMode(value: string) {
  linkMode.value = value
  emit('change', { linkedArticleId: null, linkedLink: value === 'link' ? { url: '', title: '' } : null })
  if (value === 'article') emit('search-articles', '')
}
function selectMedia(asset: MediaAsset) {
  if (props.value.images.length < 9 && !props.value.images.includes(asset.url))
    change('images', [...props.value.images, asset.url])
}
</script>
<style scoped lang="scss">
.moment-editor {
  max-width: 1050px;
  display: grid;
  gap: 1rem;
}
.moment-editor__heading,
.moment-editor__actions,
.moment-editor__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-right: auto;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
fieldset {
  border: 0;
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.moment-editor__row > label {
  flex: 1 1 180px;
}

input,
textarea,
select {
  width: 100%;
}
textarea {
  resize: vertical;
}

.moment-editor__check {
  display: flex;
  align-items: center;
}
.moment-editor__check input {
  width: auto;
}
.moment-editor__recovery {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.moment-editor__recovery p,
blockquote {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.moment-editor__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}
figure {
  margin: 0;
  min-width: 0;
}
figure img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.5rem;
}
.moment-editor__actions {
  padding: 1rem 0;
}
</style>
