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
          <PromptEditorComparison
            ref="comparisonRef"
            :loading="editor.loading.value"
            :error="editor.error.value"
            :ready="editor.ready.value"
            :requires-reload="editor.requiresReload.value"
            :notice="editor.notice.value"
            :local-error="editor.localError.value"
            :recovery="editor.recovery.value"
            :server-version="editor.serverVersion.value"
            :saving="editor.saving.value"
            @load="editor.load"
            @persist="editor.persist"
            @restore-recovery="editor.restoreRecovery"
            @discard-recovery="editor.discardRecovery"
            @merge="editor.merge"
          />
          <form
            ref="formElement"
            class="prompt-editor__form"
            :aria-busy="editor.saving.value"
            novalidate
            @submit.prevent="submit(form.status)"
          >
            <fieldset :disabled="!editor.ready.value || editor.loading.value || editor.saving.value">
              <div class="prompt-editor__columns">
                <PromptEditorVisual
                  ref="visualRef"
                  :attempted="attempted"
                  :field-errors="fieldErrors"
                  @open-media="mediaOpen = true"
                />
                <PromptEditorFields
                  ref="fieldsRef"
                  :models="models"
                  :attempted="attempted"
                  :field-errors="fieldErrors"
                />
              </div>
            </fieldset>
            <PromptEditorFooter
              :has-error="!!(editor.error.value || editor.localError.value)"
              :footer-status="footerStatus"
              :status="form.status"
              :ready="editor.ready.value"
              :loading="editor.loading.value"
              :saving="editor.saving.value"
              @submit="submit"
            />
          </form>
        </template>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { ManagedPrompt, PromptForm, PromptStatus } from '~/features/prompt/types'
import { promptFormErrors } from '~/features/prompt/editor'
import type { MediaAsset } from '~/features/media/types'

const props = defineProps<{ id: number | null; models: string[] }>()
const emit = defineEmits<{ close: []; saved: [item: ManagedPrompt] }>()
const { open: openLogin, isOpen: loginOpen, preferModal: preferLoginModal } = useLoginDrawer()
const { t } = useI18n()
const editor = usePromptEditor(props.id, (item) => emit('saved', item)),
  form = editor.form
provide('promptForm', form)

const dialog = ref<HTMLElement | null>(null),
  mediaOpen = ref(false),
  mediaBusy = ref(false)
const formElement = ref<HTMLFormElement | null>(null),
  comparisonRef = ref<{ focus: () => void } | null>(null),
  visualRef = ref<{ focusMediaButton: () => void } | null>(null),
  fieldsRef = ref<{ openOptional: () => void } | null>(null),
  lockedPanel = ref<HTMLElement | null>(null)
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
      comparisonRef.value?.focus()
    }
    return
  }
  if (['negativePrompt', 'sourceUrl'].includes(first)) fieldsRef.value?.openOptional()
  await nextTick()
  formElement.value?.querySelector<HTMLElement>(`[data-prompt-field="${first}"]`)?.focus()
}

async function returnFromMedia() {
  mediaOpen.value = false
  await nextTick()
  visualRef.value?.focusMediaButton()
}

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
.prompt-editor__primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--accent-action);
  font-size: 0.75rem;
  background: var(--accent-action);
  color: #fff;
}
.prompt-editor__secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.75rem;
  background: var(--surface-2);
  color: var(--text-main);
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
  .prompt-editor__header {
    padding: 1rem;
  }
}
@media (max-height: 520px) {
  .prompt-editor {
    padding: 0.5rem;
  }
  .prompt-editor__panel {
    max-height: calc(100dvh - 1rem);
    scroll-padding-block: 5rem 1rem;
  }
  .prompt-editor__header {
    padding: 0.75rem 1rem;
  }
}
</style>
