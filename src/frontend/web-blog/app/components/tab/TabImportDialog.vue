<!--
  @file TabImportDialog.vue
  @description 书签导入对话框：解析 JSON 或浏览器 HTML，预览数量，支持合并/追加/覆盖
  @author TixXin
  @since 2026-04-15
-->

<template>
  <Teleport to="body">
    <div v-if="visible" ref="backdropRef" class="tid-backdrop" @click.self="close" />
    <Transition name="tid">
      <div
        v-if="visible"
        ref="dialogRef"
        class="tid-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('misc.tab.import.title')"
        tabindex="-1"
      >
        <header class="tid-header">
          <Icon name="lucide:download" size="16" />
          <h2>{{ $t('misc.tab.import.title') }}</h2>
          <button type="button" class="tid-close" :aria-label="$t('misc.tab.common.close')" @click="close">
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <div class="tid-body">
          <label class="tid-dropzone">
            <input type="file" accept=".json,.html,.htm" @change="onFile" />
            <Icon name="lucide:upload-cloud" size="28" />
            <span class="tid-dropzone__hint">
              <strong>{{ $t('misc.tab.import.chooseFile') }}</strong>
              <small>{{ $t('misc.tab.import.fileHint') }}</small>
            </span>
          </label>

          <p v-if="error" class="tid-error">
            <Icon name="lucide:alert-circle" size="12" />
            {{ error }}
          </p>

          <div v-if="payload" class="tid-preview">
            <div class="tid-preview__stat">
              <span class="tid-preview__num">{{ payload.categories.length }}</span>
              <span class="tid-preview__label">{{
                $t('misc.tab.import.categoryUnit', payload.categories.length)
              }}</span>
            </div>
            <div class="tid-preview__stat">
              <span class="tid-preview__num">{{ payload.bookmarks.length }}</span>
              <span class="tid-preview__label">{{ $t('misc.tab.import.bookmarkUnit', payload.bookmarks.length) }}</span>
            </div>
          </div>

          <TabImportModeOptions v-if="payload" v-model="mode" />
        </div>

        <footer class="tid-footer">
          <button type="button" class="tid-btn" @click="close">{{ $t('misc.tab.common.cancel') }}</button>
          <button type="button" class="tid-btn tid-btn--primary" :disabled="!payload || importing" @click="onConfirm">
            <Icon v-if="importing" name="lucide:loader-2" size="12" class="tid-spin" />
            {{ $t('misc.tab.import.confirm') }}
          </button>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { MAX_IMPORT_BYTES } from '~/features/tab/validation'
import type { ImportMode, ImportPayload } from '~/features/tab/types'
import { importPayloadFromFile } from '~/features/tab/importFile'
import TabImportModeOptions from './TabImportModeOptions.vue'

const visible = defineModel<boolean>('visible', { default: false })
const dialogRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
useModalFocus(visible, dialogRef, { close, extra: () => [backdropRef.value] })

const { importBulk } = useTabBookmarks()
const { success, error: toastError } = useToast()

const payload = ref<ImportPayload | null>(null)
const mode = ref<ImportMode>('merge')
const error = ref('')
const importing = ref(false)

const { t } = useI18n()

watch(visible, (v) => {
  if (!v) {
    payload.value = null
    error.value = ''
    mode.value = 'merge'
  }
})

function close() {
  visible.value = false
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  payload.value = null
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error(t('misc.tab.validation.fileTooLarge', { size: '5 MB' }))
    const raw = await file.text()
    payload.value = importPayloadFromFile(file.name, raw, t)
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('misc.tab.import.parseFailed')
  } finally {
    input.value = ''
  }
}

async function onConfirm() {
  const submitted = payload.value
  if (!submitted || importing.value) return
  importing.value = true
  try {
    const ok = await importBulk(submitted, mode.value)
    if (ok) {
      success(
        t('misc.tab.import.success', {
          categories: t('misc.tab.import.categoryCount', submitted.categories.length),
          bookmarks: t('misc.tab.common.bookmarkCount', submitted.bookmarks.length),
        }),
      )
      // 导入期间可能关闭窗口或选择另一份文件，只关闭本次提交对应的预览。
      if (payload.value === submitted) close()
    } else {
      toastError(t('misc.tab.import.loginRequired'))
    }
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('misc.tab.import.failed'))
  } finally {
    importing.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-import-dialog' as importDialog;

@include importDialog.dialog;
</style>
