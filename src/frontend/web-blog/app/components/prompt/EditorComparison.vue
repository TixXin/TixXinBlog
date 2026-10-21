<!-- @file EditorComparison.vue @description 提示词编辑器反馈区、本地恢复与服务器版本冲突对比 -->
<template>
  <div ref="root" class="prompt-editor__feedback" tabindex="-1">
    <p v-if="loading">{{ $t('misc.prompt.editor.loading') }}</p>
    <p v-if="error" role="alert">
      {{ error
      }}<button v-if="!ready && !requiresReload" type="button" :disabled="loading" @click="$emit('load')">
        {{ $t('misc.prompt.editor.reload') }}
      </button>
    </p>
    <p v-if="requiresReload">{{ $t('misc.prompt.editor.requiresReload') }}</p>
    <p v-if="notice">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError
      }}<button type="button" @click="$emit('persist')">{{ $t('misc.prompt.editor.retryPersist') }}</button>
    </p>
    <section v-if="recovery" class="prompt-editor__recovery">
      <h3>{{ $t('misc.prompt.editor.recoveryTitle') }}</h3>
      <p>
        {{ recovery.form.title || $t('misc.prompt.editor.untitled') }} ·
        {{ recovery.savedAt }}
      </p>
      <details>
        <summary>{{ $t('misc.prompt.editor.recoveryView') }}</summary>
        <dl class="prompt-editor__comparison">
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldPrompt') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
              {{ recovery.form.prompt || $t('misc.prompt.editor.empty') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldDescription') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0">
              {{ recovery.form.description || $t('misc.prompt.editor.empty') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldNegative') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
              {{ recovery.form.negativePrompt || $t('misc.prompt.editor.empty') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldModelTags') }}</dt>
            <dd>
              {{ recovery.form.model || $t('misc.prompt.shared.modelUnset') }} ·
              {{ recovery.form.tags.join(' / ') || $t('misc.prompt.editor.noTags') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldImageSource') }}</dt>
            <dd>
              {{
                recovery.form.imageSource === 'external'
                  ? recovery.form.externalImageUrl || $t('misc.prompt.editor.externalUnset')
                  : recovery.form.mediaId
                    ? $t('misc.prompt.editor.mediaSelected')
                    : $t('misc.prompt.editor.noImage')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldImageAlt') }}</dt>
            <dd>{{ recovery.form.imageAlt || $t('misc.prompt.editor.empty') }}</dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldSource') }}</dt>
            <dd>{{ recovery.form.sourceUrl || $t('misc.prompt.editor.empty') }}</dd>
          </div>
        </dl>
      </details>
      <button type="button" :disabled="!ready || saving" @click="$emit('restoreRecovery')">
        {{ $t('misc.prompt.editor.restore') }}</button
      ><button type="button" :disabled="saving" @click="$emit('discardRecovery')">
        {{ $t('misc.prompt.editor.discard') }}
      </button>
    </section>
    <section v-if="serverVersion" class="prompt-editor__recovery">
      <h3>{{ $t('misc.prompt.editor.serverTitle', { revision: serverVersion.revision }) }}</h3>
      <details open>
        <summary>
          {{ serverVersion.title }} ·
          {{
            serverVersion.status === 'published'
              ? $t('misc.prompt.editor.statusPublished')
              : $t('misc.prompt.shared.draft')
          }}
        </summary>
        <p>{{ $t('misc.prompt.editor.serverHint') }}</p>
        <dl class="prompt-editor__comparison">
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldPrompt') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
              {{ serverVersion.prompt }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldDescription') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0">
              {{ serverVersion.description || $t('misc.prompt.editor.empty') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldNegative') }}</dt>
            <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
              {{ serverVersion.negativePrompt || $t('misc.prompt.editor.empty') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldModelTags') }}</dt>
            <dd>
              {{ serverVersion.model || $t('misc.prompt.shared.modelUnset') }} ·
              {{ serverVersion.tags.join(' / ') || $t('misc.prompt.editor.noTags') }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldImage') }}</dt>
            <dd>
              <CommonImageFrame
                class="prompt-editor__comparison-image"
                :src="serverVersion.imageUrl"
                :alt="serverVersion.imageAlt || serverVersion.title"
                :width="serverVersion.width || undefined"
                :height="serverVersion.height || undefined"
                fit="contain"
              /><span>{{
                serverVersion.mediaId ? $t('misc.prompt.editor.mediaImage') : $t('misc.prompt.editor.externalImage')
              }}</span
              ><a :href="serverVersion.imageUrl" target="_blank" rel="noopener noreferrer"
                >{{ $t('misc.prompt.editor.openServerImage') }}<Icon name="lucide:external-link" size="13"
              /></a>
            </dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldImageAlt') }}</dt>
            <dd>{{ serverVersion.imageAlt || $t('misc.prompt.editor.empty') }}</dd>
          </div>
          <div>
            <dt>{{ $t('misc.prompt.editor.fieldSource') }}</dt>
            <dd>
              <a
                v-if="serverVersion.sourceUrl"
                :href="serverVersion.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ serverVersion.sourceUrl }}<Icon name="lucide:external-link" size="13" /></a
              ><span v-else>{{ $t('misc.prompt.editor.empty') }}</span>
            </dd>
          </div>
        </dl>
      </details>
      <button type="button" :disabled="saving" @click="$emit('merge')">
        {{ $t('misc.prompt.editor.merge') }}
      </button>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { PromptRecovery } from '~/features/prompt/editor'
import type { ManagedPrompt } from '~/features/prompt/types'

defineProps<{
  loading: boolean
  error: string
  ready: boolean
  requiresReload: boolean
  notice: string
  localError: string
  recovery: PromptRecovery | null
  serverVersion: ManagedPrompt | null
  saving: boolean
}>()

defineEmits<{
  load: []
  persist: []
  restoreRecovery: []
  discardRecovery: []
  merge: []
}>()

const root = ref<HTMLElement | null>(null)
defineExpose({ focus: () => root.value?.focus() })
</script>
<style scoped lang="scss">
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
h3 {
  font-size: 0.875rem;
  font-weight: 600;
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
summary {
  cursor: var(--interaction-cursor, pointer);
  padding-block: 0.5rem;
}
@media (max-width: 720px) {
  .prompt-editor__feedback {
    padding: 0 1rem;
  }
}
</style>
