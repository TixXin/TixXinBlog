<!-- @file LinkForm.vue @description 博主未开放申请时，友链资料仅在本机整理与复制，不提交给博主 -->
<template>
  <section class="link-form">
    <h2><Icon name="lucide:clipboard-pen" size="18" />{{ $t('interaction.linkForm.title') }}</h2>
    <p>{{ $t('interaction.linkForm.intro') }}</p>
    <form @submit.prevent="$emit('copy')">
      <fieldset :disabled="!ready">
        <label
          >{{ $t('interaction.linkForm.name')
          }}<input
            :value="value.name"
            :aria-label="$t('interaction.linkForm.nameLabel')"
            maxlength="80"
            required
            @input="change('name', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >{{ $t('interaction.linkForm.url')
          }}<input
            :value="value.url"
            :aria-label="$t('interaction.linkForm.urlLabel')"
            type="url"
            pattern="https?://.+"
            maxlength="2048"
            required
            placeholder="https://example.com"
            @input="change('url', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >{{ $t('interaction.linkForm.avatar')
          }}<input
            :value="value.avatar"
            :aria-label="$t('interaction.linkForm.avatarLabel')"
            type="url"
            pattern="https?://.+"
            maxlength="2048"
            placeholder="https://example.com/avatar.png"
            @input="change('avatar', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >{{ $t('interaction.linkForm.description')
          }}<input
            :value="value.description"
            :aria-label="$t('interaction.linkForm.descriptionLabel')"
            maxlength="300"
            @input="change('description', ($event.target as HTMLInputElement).value)"
        /></label>
      </fieldset>
      <button type="submit" :disabled="!ready || !valid || copying">
        {{ copying ? $t('interaction.linkForm.copying') : $t('interaction.linkForm.copy') }}
      </button>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="storageError" role="alert">
        {{ storageError }}
        <button type="button" @click="$emit('persist')">{{ $t('interaction.linkForm.retryPersist') }}</button>
      </p>
      <p v-if="notice" role="status">{{ notice }}</p>
    </form>
  </section>
</template>
<script setup lang="ts">
import type { LocalLinkDraft } from '~/features/link/types'
defineProps<{
  value: LocalLinkDraft
  ready: boolean
  valid: boolean
  copying: boolean
  error: string
  notice: string
  storageError: string
}>()
const emit = defineEmits<{ change: [value: Partial<LocalLinkDraft>]; copy: []; persist: [] }>()
function change<K extends keyof LocalLinkDraft>(key: K, value: LocalLinkDraft[K]) {
  emit('change', { [key]: value })
}
</script>
<style scoped lang="scss">
.link-form {
  border: 1px solid var(--border);
  border-radius: $radius-card;
  background: var(--surface-2);
  padding: 1.25rem;
  margin-top: 1.5rem;
  overflow-wrap: anywhere;
}
h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
}
p {
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.7;
  margin-block: 0.75rem;
}
fieldset {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  min-width: 0;
  padding: 0;
  border: 0;
  margin-bottom: 1rem;
  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
label {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
input,
button {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
}
input {
  font-size: 0.875rem;
  transition: border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}
button {
  width: auto;
  padding-inline: 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);

  &:not(:disabled):hover {
    border-color: var(--accent);
    color: var(--accent-text);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
button:disabled {
  opacity: 0.5;
  cursor: var(--interaction-cursor, not-allowed);
}
</style>
