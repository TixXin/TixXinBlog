<!-- @file PostPreviewLink.vue @description 草稿预览链接的分享说明、有效期与可访问复制入口。 -->
<template>
  <section class="post-preview-link" :aria-labelledby="titleId">
    <h2 :id="titleId">{{ $t('admin-content.postPreview.title') }}</h2>
    <p :id="descriptionId">
      {{ $t('admin-content.postPreview.description') }}
    </p>
    <p>{{ $t('admin-content.postPreview.unavailableStates') }}</p>
    <p v-if="!saved">{{ $t('admin-content.postPreview.notSaved') }}</p>
    <p v-else-if="!available">{{ $t('admin-content.postPreview.notDraft') }}</p>
    <p v-if="dirty">{{ $t('admin-content.postPreview.dirty') }}</p>
    <div class="post-preview-link__actions">
      <CommonTooltip :content="$t('admin-content.postPreview.generateTooltip')">
        <button
          type="button"
          :disabled="!available || busy || pending"
          :aria-busy="pending"
          :aria-describedby="descriptionId"
          @click="$emit('generate')"
        >
          <Icon name="lucide:link" size="16" aria-hidden="true" />
          {{
            pending
              ? $t('admin-content.postPreview.generating')
              : url
                ? $t('admin-content.postPreview.regenerate')
                : $t('admin-content.postPreview.generate')
          }}
        </button>
      </CommonTooltip>
      <template v-if="url">
        <CommonTooltip :content="$t('admin-content.postPreview.copyTooltip')">
          <button type="button" :disabled="busy || pending || copying" :aria-busy="copying" @click="$emit('copy')">
            <Icon name="lucide:copy" size="16" aria-hidden="true" />
            {{ copying ? $t('admin-content.postPreview.copying') : $t('admin-content.postPreview.copy') }}
          </button>
        </CommonTooltip>
        <a :href="url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{
          $t('admin-content.postPreview.open')
        }}</a>
      </template>
    </div>
    <template v-if="url">
      <p>
        <i18n-t keypath="admin-content.postPreview.expires" scope="global">
          <template #time>
            <time :datetime="expiresAt">{{ expiresLabel }}</time>
          </template>
        </i18n-t>
      </p>
      <label
        >{{ $t('admin-content.postPreview.linkLabel')
        }}<input :value="url" type="url" readonly autocomplete="off" spellcheck="false"
      /></label>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
    <p role="status" aria-live="polite">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  saved: boolean
  available: boolean
  dirty: boolean
  busy: boolean
  pending: boolean
  copying: boolean
  url: string
  expiresAt: string
  error: string
  notice: string
}>()
defineEmits<{ generate: []; copy: [] }>()
const titleId = useId()
const descriptionId = useId()
const expiresLabel = computed(() => formatDateTime(props.expiresAt, { hour12: false }))
</script>

<style scoped lang="scss">
.post-preview-link {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  p {
    margin: 0.5rem 0;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  label {
    display: grid;
    gap: 0.4rem;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.6rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  :is(button, a, input):focus-visible {
    outline: 2px solid var(--text-main);
    outline-offset: 3px;
  }
}

.post-preview-link__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
