<!--
  @file TabImportDialog.vue
  @description 书签导入对话框：解析 JSON 或浏览器 HTML，预览数量，支持合并/追加/覆盖
  @author TixXin
  @since 2026-04-15
-->

<template>
  <Teleport to="body">
    <div v-if="visible" class="tid-backdrop" @click.self="close" />
    <Transition name="tid">
      <div v-if="visible" class="tid-dialog" role="dialog" aria-label="导入书签">
        <header class="tid-header">
          <Icon name="lucide:download" size="16" />
          <h2>导入书签</h2>
          <button type="button" class="tid-close" aria-label="关闭" @click="close">
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <div class="tid-body">
          <label class="tid-dropzone">
            <input type="file" accept=".json,.html,.htm" @change="onFile">
            <Icon name="lucide:upload-cloud" size="28" />
            <span class="tid-dropzone__hint">
              <strong>选择文件</strong>
              <small>支持 JSON 导出文件或浏览器书签 HTML</small>
            </span>
          </label>

          <p v-if="error" class="tid-error">
            <Icon name="lucide:alert-circle" size="12" />
            {{ error }}
          </p>

          <div v-if="payload" class="tid-preview">
            <div class="tid-preview__stat">
              <span class="tid-preview__num">{{ payload.categories.length }}</span>
              <span class="tid-preview__label">个分类</span>
            </div>
            <div class="tid-preview__stat">
              <span class="tid-preview__num">{{ payload.bookmarks.length }}</span>
              <span class="tid-preview__label">个书签</span>
            </div>
          </div>

          <div v-if="payload" class="tid-mode">
            <span class="tid-mode__label">导入策略</span>
            <div class="tid-mode__options">
              <label v-for="opt in modeOptions" :key="opt.value" class="tid-mode__opt">
                <input v-model="mode" type="radio" :value="opt.value">
                <div>
                  <div class="tid-mode__opt-title">{{ opt.label }}</div>
                  <div class="tid-mode__opt-desc">{{ opt.desc }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <footer class="tid-footer">
          <button type="button" class="tid-btn" @click="close">取消</button>
          <button
            type="button"
            class="tid-btn tid-btn--primary"
            :disabled="!payload || importing"
            @click="onConfirm"
          >
            <Icon v-if="importing" name="lucide:loader-2" size="12" class="tid-spin" />
            确认导入
          </button>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { ImportMode, ImportPayload } from '~/features/tab/types'
import { parseImportJson } from '~/features/tab/export'
import { parseNetscapeBookmarks } from '~/features/tab/import-netscape'

const visible = defineModel<boolean>('visible', { default: false })

const { importBulk } = useTabBookmarks()
const { success, error: toastError } = useToast()

const payload = ref<ImportPayload | null>(null)
const mode = ref<ImportMode>('merge')
const error = ref('')
const importing = ref(false)

const modeOptions: { value: ImportMode; label: string; desc: string }[] = [
  { value: 'merge', label: '合并（推荐）', desc: '同名分类跳过，相同 URL 的书签跳过' },
  { value: 'append', label: '追加', desc: '全部新增，允许同名重复' },
  { value: 'replace', label: '覆盖', desc: '先清空当前数据，再导入新数据' },
]

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
    const raw = await file.text()
    if (file.name.toLowerCase().endsWith('.json')) {
      const exp = parseImportJson(raw)
      payload.value = {
        categories: exp.categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color })),
        bookmarks: exp.bookmarks.map((b) => {
          const cat = exp.categories.find((c) => c.id === b.categoryId)
          return {
            categoryName: cat?.name ?? '导入',
            name: b.name,
            url: b.url,
            icon: b.icon,
            color: b.color,
            description: b.description,
          }
        }),
      }
    } else {
      payload.value = parseNetscapeBookmarks(raw)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析失败'
  } finally {
    input.value = ''
  }
}

async function onConfirm() {
  if (!payload.value) return
  importing.value = true
  try {
    const ok = await importBulk(payload.value, mode.value)
    if (ok) {
      success(`已导入 ${payload.value.categories.length} 个分类、${payload.value.bookmarks.length} 个书签`)
      close()
    } else {
      toastError('导入失败，请先登录后再试')
    }
  } catch (err) {
    toastError(err instanceof Error ? err.message : '导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style lang="scss" scoped>
.tid-backdrop {
  position: fixed;
  inset: 0;
  z-index: 299;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.tid-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 300;
  transform: translate(-50%, -50%);
  width: min(480px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
}

.tid-enter-active,
.tid-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tid-enter-from,
.tid-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 8px));
}

.tid-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.125rem;
  border-bottom: 1px solid var(--border-soft);

  h2 {
    flex: 1;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-main);
  }
}

.tid-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.tid-body {
  padding: 1rem 1.125rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.tid-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border: 2px dashed var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-soft);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  input[type='file'] {
    display: none;
  }

  strong {
    color: var(--accent);
  }

  small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.625rem;
    color: var(--text-faint);
  }
}

.tid-dropzone__hint {
  font-size: 0.8125rem;
  font-weight: 500;
}

.tid-error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: $radius-sm;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  font-size: 0.75rem;
}

.tid-preview {
  display: flex;
  gap: 0.75rem;
}

.tid-preview__stat {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  text-align: center;
}

.tid-preview__num {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.tid-preview__label {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-soft);
  margin-top: 0.125rem;
}

.tid-mode__label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.tid-mode__options {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tid-mode__opt {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  input {
    margin-top: 0.1875rem;
  }
}

.tid-mode__opt-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.tid-mode__opt-desc {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.tid-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.125rem;
  border-top: 1px solid var(--border-soft);
}

.tid-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);
  }

  &--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;

    &:hover {
      opacity: 0.88;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.tid-spin {
  animation: tid-spin 1.2s linear infinite;
}

@keyframes tid-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
