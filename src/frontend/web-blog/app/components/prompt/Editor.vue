<!-- @file Editor.vue @description 与博客同主题的页内提示词编辑器，效果图和文字并排核对 -->
<template>
  <Teleport to="body">
    <div
      ref="dialog"
      class="prompt-editor"
      :class="{ 'prompt-editor--login-open': loginOpen && preferLoginModal }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-editor-title"
      tabindex="-1"
      @click.self="close"
      @keydown="saveShortcut"
    >
      <section class="prompt-editor__panel">
        <header class="prompt-editor__header">
          <div>
            <p>
              {{ editor.id.value ? $t('misc.prompt.editor.breadcrumbEdit') : $t('misc.prompt.editor.breadcrumbNew') }}
            </p>
            <h2 id="prompt-editor-title">
              {{ editor.id.value ? $t('misc.prompt.editor.titleEdit') : $t('misc.prompt.editor.titleNew') }}
            </h2>
          </div>
          <button
            type="button"
            class="prompt-editor__close"
            :aria-label="$t('misc.prompt.editor.close')"
            :disabled="editor.saving.value"
            @click="close"
          >
            <Icon name="lucide:x" size="20" />
          </button>
        </header>
        <section
          v-if="editor.ownershipLost.value"
          ref="lockedPanel"
          class="prompt-editor__locked"
          tabindex="-1"
          :aria-label="$t('misc.prompt.editor.lockedLabel')"
        >
          <Icon name="lucide:lock-keyhole" size="24" />
          <h3>{{ $t('misc.prompt.editor.lockedTitle') }}</h3>
          <p>{{ $t('misc.prompt.editor.lockedHint') }}</p>
          <p v-if="editor.localError.value" role="alert">
            {{ $t('misc.prompt.editor.lockedKeep', { message: editor.localError.value }) }}
          </p>
          <button type="button" class="prompt-editor__primary" @click="openLogin('login', true)">
            {{ $t('misc.prompt.editor.relogin') }}
          </button>
        </section>
        <div v-if="mediaOpen" v-show="!editor.ownershipLost.value" class="prompt-editor__library">
          <button type="button" class="prompt-editor__secondary" @click="closeMedia">
            <Icon name="lucide:arrow-left" size="16" />{{ $t('misc.prompt.editor.backToEditor') }}
          </button>
          <!-- 身份失效时移出媒体DOM但保留未上传文件；恢复原身份后由媒体库自行重新核对归属。 -->
          <KeepAlive
            ><AdminMediaWorkspace
              v-if="!editor.ownershipLost.value"
              selectable
              @selected="selectMedia"
              @busy="mediaBusy = $event"
          /></KeepAlive>
        </div>
        <template v-if="!editor.ownershipLost.value && !mediaOpen">
          <div ref="feedback" class="prompt-editor__feedback" tabindex="-1">
            <p v-if="editor.loading.value">{{ $t('misc.prompt.editor.loading') }}</p>
            <p v-if="editor.error.value" role="alert">
              {{ editor.error.value
              }}<button
                v-if="!editor.ready.value && !editor.requiresReload.value"
                type="button"
                :disabled="editor.loading.value"
                @click="editor.load"
              >
                {{ $t('misc.prompt.editor.reload') }}
              </button>
            </p>
            <p v-if="editor.requiresReload.value">{{ $t('misc.prompt.editor.requiresReload') }}</p>
            <p v-if="editor.notice.value">{{ editor.notice.value }}</p>
            <p v-if="editor.localError.value" role="alert">
              {{ editor.localError.value
              }}<button type="button" @click="editor.persist">{{ $t('misc.prompt.editor.retryPersist') }}</button>
            </p>
            <section v-if="editor.recovery.value" class="prompt-editor__recovery">
              <h3>{{ $t('misc.prompt.editor.recoveryTitle') }}</h3>
              <p>
                {{ editor.recovery.value.form.title || $t('misc.prompt.editor.untitled') }} ·
                {{ editor.recovery.value.savedAt }}
              </p>
              <details>
                <summary>{{ $t('misc.prompt.editor.recoveryView') }}</summary>
                <dl class="prompt-editor__comparison">
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldPrompt') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.recovery.value.form.prompt || $t('misc.prompt.editor.empty') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldDescription') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0">
                      {{ editor.recovery.value.form.description || $t('misc.prompt.editor.empty') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldNegative') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.recovery.value.form.negativePrompt || $t('misc.prompt.editor.empty') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldModelTags') }}</dt>
                    <dd>
                      {{ editor.recovery.value.form.model || $t('misc.prompt.shared.modelUnset') }} ·
                      {{ editor.recovery.value.form.tags.join(' / ') || $t('misc.prompt.editor.noTags') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldImageSource') }}</dt>
                    <dd>
                      {{
                        editor.recovery.value.form.imageSource === 'external'
                          ? editor.recovery.value.form.externalImageUrl || $t('misc.prompt.editor.externalUnset')
                          : editor.recovery.value.form.mediaId
                            ? $t('misc.prompt.editor.mediaSelected')
                            : $t('misc.prompt.editor.noImage')
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldImageAlt') }}</dt>
                    <dd>{{ editor.recovery.value.form.imageAlt || $t('misc.prompt.editor.empty') }}</dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldSource') }}</dt>
                    <dd>{{ editor.recovery.value.form.sourceUrl || $t('misc.prompt.editor.empty') }}</dd>
                  </div>
                </dl>
              </details>
              <button
                type="button"
                :disabled="!editor.ready.value || editor.saving.value"
                @click="editor.restoreRecovery"
              >
                {{ $t('misc.prompt.editor.restore') }}</button
              ><button type="button" :disabled="editor.saving.value" @click="editor.discardRecovery">
                {{ $t('misc.prompt.editor.discard') }}
              </button>
            </section>
            <section v-if="editor.serverVersion.value" class="prompt-editor__recovery">
              <h3>{{ $t('misc.prompt.editor.serverTitle', { revision: editor.serverVersion.value.revision }) }}</h3>
              <details open>
                <summary>
                  {{ editor.serverVersion.value.title }} ·
                  {{
                    editor.serverVersion.value.status === 'published'
                      ? $t('misc.prompt.editor.statusPublished')
                      : $t('misc.prompt.shared.draft')
                  }}
                </summary>
                <p>{{ $t('misc.prompt.editor.serverHint') }}</p>
                <dl class="prompt-editor__comparison">
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldPrompt') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.serverVersion.value.prompt }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldDescription') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0">
                      {{ editor.serverVersion.value.description || $t('misc.prompt.editor.empty') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldNegative') }}</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.serverVersion.value.negativePrompt || $t('misc.prompt.editor.empty') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldModelTags') }}</dt>
                    <dd>
                      {{ editor.serverVersion.value.model || $t('misc.prompt.shared.modelUnset') }} ·
                      {{ editor.serverVersion.value.tags.join(' / ') || $t('misc.prompt.editor.noTags') }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldImage') }}</dt>
                    <dd>
                      <CommonImageFrame
                        class="prompt-editor__comparison-image"
                        :src="editor.serverVersion.value.imageUrl"
                        :alt="editor.serverVersion.value.imageAlt || editor.serverVersion.value.title"
                        :width="editor.serverVersion.value.width || undefined"
                        :height="editor.serverVersion.value.height || undefined"
                        fit="contain"
                      /><span>{{
                        editor.serverVersion.value.mediaId
                          ? $t('misc.prompt.editor.mediaImage')
                          : $t('misc.prompt.editor.externalImage')
                      }}</span
                      ><a :href="editor.serverVersion.value.imageUrl" target="_blank" rel="noopener noreferrer"
                        >{{ $t('misc.prompt.editor.openServerImage') }}<Icon name="lucide:external-link" size="13"
                      /></a>
                    </dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldImageAlt') }}</dt>
                    <dd>{{ editor.serverVersion.value.imageAlt || $t('misc.prompt.editor.empty') }}</dd>
                  </div>
                  <div>
                    <dt>{{ $t('misc.prompt.editor.fieldSource') }}</dt>
                    <dd>
                      <a
                        v-if="editor.serverVersion.value.sourceUrl"
                        :href="editor.serverVersion.value.sourceUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ editor.serverVersion.value.sourceUrl }}<Icon name="lucide:external-link" size="13" /></a
                      ><span v-else>{{ $t('misc.prompt.editor.empty') }}</span>
                    </dd>
                  </div>
                </dl>
              </details>
              <button type="button" :disabled="editor.saving.value" @click="editor.merge">
                {{ $t('misc.prompt.editor.merge') }}
              </button>
            </section>
          </div>
          <form
            ref="formElement"
            class="prompt-editor__form"
            :aria-busy="editor.saving.value"
            novalidate
            @submit.prevent="submit(form.status)"
          >
            <fieldset :disabled="!editor.ready.value || editor.loading.value || editor.saving.value">
              <div class="prompt-editor__columns">
                <section class="prompt-editor__visual">
                  <h3>{{ $t('misc.prompt.editor.visualTitle') }}</h3>
                  <p>{{ $t('misc.prompt.editor.visualHint') }}</p>
                  <div class="prompt-editor__preview">
                    <CommonImageFrame
                      v-if="previewUrl"
                      :src="previewUrl"
                      :alt="form.imageAlt || form.title || $t('misc.prompt.editor.previewAlt')"
                      fit="contain"
                      loading="eager"
                    />
                    <div v-else class="prompt-editor__placeholder">
                      <Icon name="lucide:image-plus" size="30" /><span>{{ $t('misc.prompt.editor.placeholder') }}</span>
                    </div>
                  </div>
                  <div class="prompt-editor__source" role="group" :aria-label="$t('misc.prompt.editor.sourceLabel')">
                    <button
                      type="button"
                      :aria-pressed="form.imageSource === 'media'"
                      @click="form.imageSource = 'media'"
                    >
                      {{ $t('misc.prompt.editor.sourceMedia') }}</button
                    ><button
                      type="button"
                      :aria-pressed="form.imageSource === 'external'"
                      @click="form.imageSource = 'external'"
                    >
                      {{ $t('misc.prompt.editor.sourceExternal') }}
                    </button>
                  </div>
                  <button
                    v-if="form.imageSource === 'media'"
                    ref="mediaButton"
                    v-bind="fieldAttributes('mediaId')"
                    type="button"
                    class="prompt-editor__secondary"
                    @click="mediaOpen = true"
                  >
                    <Icon name="lucide:upload" size="16" />{{
                      form.mediaId ? $t('misc.prompt.editor.changeImage') : $t('misc.prompt.editor.chooseImage')
                    }}</button
                  ><small
                    v-if="attempted && fieldErrors.mediaId"
                    id="prompt-editor-mediaId-error"
                    class="prompt-editor__field-error"
                    >{{ fieldErrors.mediaId }}</small
                  ><label v-if="form.imageSource === 'external'"
                    >{{ $t('misc.prompt.editor.externalUrl')
                    }}<input
                      v-model="form.externalImageUrl"
                      v-bind="fieldAttributes('externalImageUrl')"
                      type="url"
                      maxlength="2048"
                      placeholder="https://…"
                    /><small>{{ $t('misc.prompt.editor.externalHint') }}</small
                    ><small
                      v-if="attempted && fieldErrors.externalImageUrl"
                      id="prompt-editor-externalImageUrl-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.externalImageUrl }}</small
                    ></label
                  ><label
                    >{{ $t('misc.prompt.editor.fieldImageAlt')
                    }}<input
                      v-model="form.imageAlt"
                      v-bind="fieldAttributes('imageAlt')"
                      maxlength="240"
                      :placeholder="$t('misc.prompt.editor.imageAltPlaceholder')"
                    /><small
                      v-if="attempted && fieldErrors.imageAlt"
                      id="prompt-editor-imageAlt-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.imageAlt }}</small
                    ></label
                  >
                </section>
                <section class="prompt-editor__writing">
                  <label
                    >{{ $t('misc.prompt.editor.titleLabel')
                    }}<span class="prompt-editor__required">{{ $t('misc.prompt.editor.required') }}</span
                    ><input
                      v-model="form.title"
                      v-bind="fieldAttributes('title')"
                      required
                      maxlength="160"
                      :placeholder="$t('misc.prompt.editor.titlePlaceholder')"
                    /><small id="prompt-editor-title-count" class="prompt-editor__count"
                      >{{ form.title.length }} / {{ promptFieldLimits.title }}</small
                    ><small
                      v-if="attempted && fieldErrors.title"
                      id="prompt-editor-title-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.title }}</small
                    ></label
                  ><label
                    >{{ $t('misc.prompt.editor.descriptionLabel')
                    }}<textarea
                      v-model="form.description"
                      v-bind="fieldAttributes('description')"
                      rows="2"
                      maxlength="2000"
                      :placeholder="$t('misc.prompt.editor.descriptionPlaceholder')"
                    /><small
                      v-if="attempted && fieldErrors.description"
                      id="prompt-editor-description-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.description }}</small
                    ></label
                  ><label
                    >{{ $t('misc.prompt.editor.fieldPrompt')
                    }}<span class="prompt-editor__required">{{ $t('misc.prompt.editor.required') }}</span
                    ><textarea
                      v-model="form.prompt"
                      v-bind="fieldAttributes('prompt')"
                      class="prompt-editor__prompt"
                      required
                      rows="8"
                      maxlength="30000"
                      :placeholder="$t('misc.prompt.editor.promptPlaceholder')"
                      dir="auto"
                    /><small id="prompt-editor-prompt-count" class="prompt-editor__count"
                      >{{ form.prompt.length }} / {{ promptFieldLimits.prompt }}</small
                    ><small
                      v-if="attempted && fieldErrors.prompt"
                      id="prompt-editor-prompt-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.prompt }}</small
                    >
                  </label>
                  <div class="prompt-editor__row">
                    <label
                      >{{ $t('misc.prompt.editor.modelLabel')
                      }}<input
                        v-model="form.model"
                        v-bind="fieldAttributes('model')"
                        list="prompt-editor-models"
                        maxlength="80"
                        :placeholder="$t('misc.prompt.editor.modelPlaceholder')"
                      /><datalist id="prompt-editor-models">
                        <option v-for="model in models" :key="model" :value="model" /></datalist
                      ><small
                        v-if="attempted && fieldErrors.model"
                        id="prompt-editor-model-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.model }}</small
                      ></label
                    ><label
                      >{{ $t('misc.prompt.editor.tagsLabel')
                      }}<input
                        v-model="tagsInput"
                        v-bind="fieldAttributes('tags')"
                        :placeholder="$t('misc.prompt.editor.tagsPlaceholder')"
                        maxlength="395"
                      /><small id="prompt-editor-tags-count">{{
                        $t('misc.prompt.editor.tagsCount', { count: form.tags.length })
                      }}</small
                      ><small
                        v-if="attempted && fieldErrors.tags"
                        id="prompt-editor-tags-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.tags }}</small
                      ></label
                    >
                  </div>
                  <details ref="optionalDetails" class="prompt-editor__optional">
                    <summary>{{ $t('misc.prompt.editor.optionalSummary') }}</summary>
                    <label
                      >{{ $t('misc.prompt.editor.fieldNegative')
                      }}<textarea
                        v-model="form.negativePrompt"
                        v-bind="fieldAttributes('negativePrompt')"
                        rows="3"
                        maxlength="10000"
                        :placeholder="$t('misc.prompt.editor.negativePlaceholder')"
                        dir="auto"
                      /><small id="prompt-editor-negativePrompt-count" class="prompt-editor__count"
                        >{{ form.negativePrompt.length }} / {{ promptFieldLimits.negativePrompt }}</small
                      ><small
                        v-if="attempted && fieldErrors.negativePrompt"
                        id="prompt-editor-negativePrompt-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.negativePrompt }}</small
                      ></label
                    ><label
                      >{{ $t('misc.prompt.editor.fieldSource')
                      }}<input
                        v-model="form.sourceUrl"
                        v-bind="fieldAttributes('sourceUrl')"
                        type="url"
                        maxlength="2048"
                        :placeholder="$t('misc.prompt.editor.sourcePlaceholder')"
                      /><small
                        v-if="attempted && fieldErrors.sourceUrl"
                        id="prompt-editor-sourceUrl-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.sourceUrl }}</small
                      ></label
                    >
                  </details>
                </section>
              </div>
            </fieldset>
            <footer class="prompt-editor__footer">
              <div class="prompt-editor__save-state">
                <p
                  role="status"
                  :class="{ 'prompt-editor__save-error': editor.error.value || editor.localError.value }"
                >
                  <Icon
                    :name="editor.error.value || editor.localError.value ? 'lucide:circle-alert' : 'lucide:circle-dot'"
                    size="13"
                  />{{ footerStatus }}
                </p>
                <small v-if="form.status === 'published'">{{ $t('misc.prompt.editor.unpublishHint') }}</small>
                <small v-else class="prompt-editor__shortcut-hint">{{ $t('misc.prompt.editor.shortcutHint') }}</small>
              </div>
              <div class="prompt-editor__actions">
                <button
                  type="button"
                  class="prompt-editor__secondary"
                  :aria-keyshortcuts="form.status === 'draft' ? 'Control+s Meta+s' : undefined"
                  :disabled="!editor.ready.value || editor.loading.value || editor.saving.value"
                  @click="submit('draft')"
                >
                  {{
                    editor.saving.value
                      ? $t('misc.prompt.editor.saving')
                      : form.status === 'published'
                        ? $t('misc.prompt.editor.toDraft')
                        : $t('misc.prompt.editor.saveDraft')
                  }}</button
                ><button
                  type="button"
                  class="prompt-editor__primary"
                  :aria-keyshortcuts="form.status === 'published' ? 'Control+s Meta+s' : undefined"
                  :disabled="!editor.ready.value || editor.loading.value || editor.saving.value"
                  @click="submit('published')"
                >
                  <Icon name="lucide:arrow-up-right" size="16" />{{
                    editor.saving.value
                      ? $t('misc.prompt.editor.saving')
                      : form.status === 'published'
                        ? $t('misc.prompt.editor.saveUpdate')
                        : $t('misc.prompt.editor.publish')
                  }}
                </button>
              </div>
            </footer>
          </form>
        </template>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { ManagedPrompt, PromptForm, PromptStatus } from '~/features/prompt/types'
import { promptFieldLimits, promptFormErrors } from '~/features/prompt/editor'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{ id: number | null; models: string[] }>()
const emit = defineEmits<{ close: []; saved: [item: ManagedPrompt] }>()
const { open: openLogin, isOpen: loginOpen, preferModal: preferLoginModal } = useLoginDrawer()
const { t } = useI18n()
const editor = usePromptEditor(props.id, (item) => emit('saved', item)),
  form = editor.form
const dialog = ref<HTMLElement | null>(null),
  mediaOpen = ref(false),
  mediaBusy = ref(false)
const formElement = ref<HTMLFormElement | null>(null),
  feedback = ref<HTMLElement | null>(null),
  lockedPanel = ref<HTMLElement | null>(null),
  mediaButton = ref<HTMLButtonElement | null>(null),
  optionalDetails = ref<HTMLDetailsElement | null>(null)
const attempted = ref(false),
  fieldErrors = computed(() => promptFormErrors(form, t))
const footerStatus = computed(() => {
  if (editor.loading.value) return t('misc.prompt.editor.loading')
  if (editor.saving.value)
    return t(editor.pendingCreate.value ? 'misc.prompt.editor.checkingSave' : 'misc.prompt.editor.saving')
  if (editor.serverVersion.value) return t('misc.prompt.editor.conflict')
  if (editor.error.value) return editor.error.value
  if (editor.localError.value) return editor.localError.value
  if (editor.pendingCreate.value) return t('misc.prompt.editor.pendingCreate')
  if (editor.dirty.value) return t('misc.prompt.editor.dirty')
  return editor.notice.value || t(editor.id.value ? 'misc.prompt.editor.saved' : 'misc.prompt.editor.fresh')
})
// 字段无障碍名称与可见标签一致；在调用时取词，切换语言后随之更新
const fieldLabelKeys: Partial<Record<keyof PromptForm, string>> = {
  title: 'titleLabel',
  prompt: 'fieldPrompt',
  description: 'descriptionLabel',
  negativePrompt: 'fieldNegative',
  model: 'modelLabel',
  tags: 'tagsLabel',
  externalImageUrl: 'externalUrl',
  imageAlt: 'fieldImageAlt',
  sourceUrl: 'fieldSource',
}
function fieldAttributes(field: keyof PromptForm) {
  const descriptions = [
    ['title', 'prompt', 'negativePrompt', 'tags'].includes(field) ? `prompt-editor-${field}-count` : '',
    attempted.value && fieldErrors.value[field] ? `prompt-editor-${field}-error` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    'data-prompt-field': field,
    'aria-label': fieldLabelKeys[field] ? t(`misc.prompt.editor.${fieldLabelKeys[field]}`) : undefined,
    'aria-invalid': (attempted.value && !!fieldErrors.value[field]) || undefined,
    'aria-describedby': descriptions || undefined,
  }
}
function saveShortcut(event: KeyboardEvent) {
  if (
    !(event.ctrlKey || event.metaKey) ||
    event.key.toLowerCase() !== 's' ||
    event.shiftKey ||
    event.altKey ||
    event.isComposing ||
    event.keyCode === 229 ||
    mediaOpen.value
  )
    return
  event.preventDefault()
  // 快捷键沿用当前发布状态，新建时只保存草稿；载入和提交期间不重复触发。
  if (event.repeat || !editor.ready.value || editor.loading.value || editor.saving.value) return
  void submit(form.status)
}
async function submit(status: PromptStatus) {
  if (!editor.ready.value || editor.loading.value || editor.saving.value) return
  attempted.value = true
  await editor.save(status)
  const first = Object.keys(fieldErrors.value)[0] as keyof PromptForm | undefined
  if (!first) {
    if (editor.error.value) {
      await nextTick()
      feedback.value?.focus()
    }
    return
  }
  if (['negativePrompt', 'sourceUrl'].includes(first) && optionalDetails.value) optionalDetails.value.open = true
  await nextTick()
  formElement.value?.querySelector<HTMLElement>(`[data-prompt-field="${first}"]`)?.focus()
}
async function returnFromMedia() {
  mediaOpen.value = false
  await nextTick()
  mediaButton.value?.focus({ preventScroll: true })
}
const previewUrl = computed(() =>
  form.imageSource === 'external' ? form.externalImageUrl : form.mediaId ? `/api/v1/media/${form.mediaId}.webp` : '',
)
const parseTags = (value: string) => [
  ...new Set(
    value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
]
// 回显标签时按界面语言使用中文逗号或英文逗号，解析时两种都接受
const tagsInput = ref(form.tags.join(t('misc.prompt.editor.tagJoiner')))
watch(tagsInput, (value) => {
  form.tags = parseTags(value)
})
watch(
  () => form.tags,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(parseTags(tagsInput.value)))
      tagsInput.value = value.join(t('misc.prompt.editor.tagJoiner'))
  },
)
function closeMedia() {
  if (mediaBusy.value && !window.confirm(t('misc.prompt.editor.mediaLeaveConfirm'))) return
  void returnFromMedia()
}
function close() {
  if (mediaOpen.value && !editor.ownershipLost.value) {
    closeMedia()
    return
  }
  // 页面按URL关闭弹层，统一交给路由守卫保护输入，避免关闭按钮和历史导航重复确认。
  emit('close')
}
function selectMedia(asset: MediaAsset) {
  form.mediaId = asset.id
  form.imageAlt ||= asset.alt
  void returnFromMedia()
}
const { isTopModal } = useModalFocus(true, dialog, { close })
watch(editor.ownershipLost, async (lost) => {
  if (!lost) return
  await nextTick()
  if (isTopModal()) lockedPanel.value?.focus({ preventScroll: true })
})
</script>
<style scoped lang="scss">
.prompt-editor {
  position: fixed;
  inset: 0;
  z-index: 110;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 20, 0.65);
  backdrop-filter: blur(8px);
}
.prompt-editor--login-open {
  // 登录弹窗的共享层级是84；保留编辑器实例和内存，但让认证弹窗在上层接管焦点。
  z-index: 83;
}
.prompt-editor__locked {
  display: grid;
  justify-items: start;
  gap: 0.9rem;
  padding: 2rem;
  color: var(--text-main);
}
.prompt-editor__locked > :first-child {
  color: var(--text-soft);
}
.prompt-editor__locked p {
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.8;
}
.prompt-editor__locked:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.prompt-editor__panel {
  width: min(1050px, 100%);
  max-height: 92dvh;
  overflow: auto;
  scroll-padding-block: 6rem 8rem;
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  color: var(--text-main);
  background: var(--surface-1);
}
.prompt-editor__header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface-1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
}
.prompt-editor__header p {
  font-size: 0.7rem;
  color: var(--text-soft);
  letter-spacing: 0.1em;
}
h2 {
  margin-top: 0.35rem;
  font-size: 1.3rem;
  font-weight: 600;
}
h3 {
  font-size: 0.875rem;
  font-weight: 600;
}
.prompt-editor__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--text-main);
  border-radius: 50%;
  background: var(--surface-2);
}
.prompt-editor__feedback {
  padding: 0 2rem;
  font-size: 0.8125rem;
  line-height: 1.8;
}
.prompt-editor__feedback > p {
  margin-top: 1rem;
}
.prompt-editor__feedback:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.prompt-editor__feedback button {
  color: var(--accent-text);
  padding: 0.5rem;
  min-height: 40px;
}
.prompt-editor__recovery {
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
}
.prompt-editor__recovery p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 12rem;
  overflow: auto;
}

.prompt-editor__comparison {
  display: grid;
  gap: 0.85rem;
  margin: 1rem 0;
}
.prompt-editor__comparison dt {
  color: var(--text-soft);
  font-size: 0.72rem;
  margin-bottom: 0.3rem;
}
.prompt-editor__comparison dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.prompt-editor__comparison a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-text);
  margin-left: 0.75rem;
  max-width: 100%;
}
.prompt-editor__comparison-image {
  max-width: 240px;
  max-height: 180px;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
}
.prompt-editor__long-text {
  max-height: 12rem;
  overflow: auto;
  padding-right: 0.5rem;
}
.prompt-editor__long-text:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.prompt-editor__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.prompt-editor__field-error {
  color: var(--danger);
}
[aria-invalid='true'] {
  border-color: var(--danger);
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.prompt-editor__columns {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 2rem;
  padding: 1.5rem 2rem;
}
.prompt-editor__visual > p {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin: 0.4rem 0 1rem;
}
.prompt-editor__preview {
  min-height: 180px;
  border-radius: 0.7rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
}
.prompt-editor__preview :deep(.image-frame) {
  height: 240px;
}
.prompt-editor__placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
  justify-content: center;
  min-height: 230px;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.prompt-editor__source {
  display: flex;
  gap: 0.25rem;
  margin: 1rem 0 0.6rem;
}
.prompt-editor__source button {
  padding: 0.55rem 0.8rem;
  min-height: 40px;
  font-size: 0.75rem;
  color: var(--text-soft);
  border-radius: 0.4rem;
}
.prompt-editor__source button[aria-pressed='true'] {
  background: var(--surface-2);
  color: var(--text-main);
}
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
input,
textarea {
  display: block;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.7rem 0.8rem;
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 400;
  margin-top: 0.45rem;
  line-height: 1.75;
}
textarea {
  resize: vertical;
}
input::placeholder,
textarea::placeholder {
  color: var(--text-soft);
  opacity: 0.85;
}
input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
small {
  display: block;
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 400;
  margin-top: 0.4rem;
  line-height: 1.6;
}
.prompt-editor__required {
  color: var(--text-soft);
  font-size: 0.65rem;
  margin-left: 0.5rem;
  font-weight: 400;
}
.prompt-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.prompt-editor__optional {
  font-size: 0.75rem;
  color: var(--text-soft);
}
summary {
  cursor: var(--interaction-cursor, pointer);
  padding-block: 0.5rem;
}
.prompt-editor__optional label {
  margin-top: 0.5rem;
  color: var(--text-main);
}
.prompt-editor__footer {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  background: var(--surface-1);
  padding: 1rem 2rem;
  border-top: 1px solid var(--border);
}
.prompt-editor__footer p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.prompt-editor__footer p :deep(svg) {
  flex-shrink: 0;
}
.prompt-editor__save-state {
  flex: 1 1 15rem;
  min-width: 0;
}
.prompt-editor__footer .prompt-editor__save-error {
  color: var(--danger);
}
.prompt-editor__actions {
  display: flex;
  gap: 0.6rem;
}
.prompt-editor__secondary,
.prompt-editor__primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.75rem;
}
.prompt-editor__secondary {
  background: var(--surface-2);
  color: var(--text-main);
}
.prompt-editor__primary {
  background: var(--accent-action);
  color: #fff;
  border-color: var(--accent-action);
}
.prompt-editor__visual > .prompt-editor__secondary {
  margin-bottom: 1rem;
  width: 100%;
  justify-content: center;
}
button:disabled,
fieldset:disabled {
  opacity: 0.6;
}
.prompt-editor__library {
  padding: 1.5rem 2rem;
}
@media (max-width: 720px) {
  .prompt-editor {
    padding: 0.6rem;
  }
  .prompt-editor__panel {
    max-height: 96dvh;
  }
  .prompt-editor__columns {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1rem;
  }
  .prompt-editor__header,
  .prompt-editor__footer {
    padding: 1rem;
  }
  .prompt-editor__feedback {
    padding: 0 1rem;
  }
  .prompt-editor__preview :deep(.image-frame) {
    height: 200px;
  }
  .prompt-editor__row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .prompt-editor__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
// 键盘弹出或横屏时让操作区回到文档流，避免粘性页脚遮住输入；关闭入口仍可见。
@media (max-height: 520px) {
  .prompt-editor {
    padding: 0.5rem;
  }
  .prompt-editor__panel {
    max-height: calc(100dvh - 1rem);
    scroll-padding-block: 5rem 1rem;
  }
  .prompt-editor__header,
  .prompt-editor__footer {
    padding: 0.75rem 1rem;
  }
  .prompt-editor__footer {
    position: static;
  }
  .prompt-editor__preview :deep(.image-frame) {
    height: 160px;
  }
  .prompt-editor__placeholder {
    min-height: 160px;
  }
}
</style>
