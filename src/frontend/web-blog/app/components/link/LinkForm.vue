<!-- @file LinkForm.vue @description 友链资料仅在本机整理与复制，在线申请明确未开放 -->
<template>
  <section class="link-form">
    <h3><Icon name="lucide:clipboard-pen" size="18" />整理友链资料</h3>
    <p>在线申请尚未开放。你可以在下方整理并复制友链资料；内容只保存在本标签页，不会自动提交给博主。</p>
    <form @submit.prevent="$emit('copy')">
      <fieldset :disabled="!ready">
        <label
          >站点名称<input
            :value="value.name"
            aria-label="整理站点名称"
            maxlength="80"
            required
            @input="change('name', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >站点地址<input
            :value="value.url"
            aria-label="整理站点地址"
            type="url"
            pattern="https?://.+"
            maxlength="2048"
            required
            placeholder="https://example.com"
            @input="change('url', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >头像地址（可选）<input
            :value="value.avatar"
            aria-label="整理头像地址"
            type="url"
            pattern="https?://.+"
            maxlength="2048"
            placeholder="https://example.com/avatar.png"
            @input="change('avatar', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >一句话描述<input
            :value="value.description"
            aria-label="整理站点描述"
            maxlength="300"
            @input="change('description', ($event.target as HTMLInputElement).value)"
        /></label>
      </fieldset>
      <button type="submit" :disabled="!ready || !valid || copying">
        {{ copying ? '正在复制…' : '复制友链资料' }}
      </button>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="storageError" role="alert">
        {{ storageError }} <button type="button" @click="$emit('persist')">重试保存恢复副本</button>
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
h3 {
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
button {
  width: auto;
}
button:disabled {
  opacity: 0.5;
}
</style>
