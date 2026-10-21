<!-- @file PromptAuthBanner.vue @description 提示词页面管理意图与鉴权异常状态提示横幅 -->
<template>
  <div class="prompts-auth" role="status">
    <Icon name="lucide:lock-keyhole" size="18" />
    <div>
      <strong>{{
        restoringPending ? $t('misc.prompt.page.authChecking') : authError || $t('misc.prompt.page.authHint')
      }}</strong>
      <p>{{ $t('misc.prompt.page.authPublic') }}</p>
    </div>
    <button v-if="authError" type="button" :disabled="restoringPending" @click="$emit('restore')">
      {{ $t('misc.prompt.page.authRetry') }}
    </button>
    <button type="button" :disabled="restoringPending" @click="$emit('login')">
      {{ $t('misc.prompt.page.login') }}
    </button>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  authError: string
  restoringPending: boolean
}>()

defineEmits<{
  restore: []
  login: []
}>()
</script>
<style scoped lang="scss">
.prompts-auth {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  color: var(--text-muted);
  background: var(--surface-2);
}
.prompts-auth > div {
  flex: 1;
  min-width: 160px;
}
.prompts-auth strong {
  font-size: 0.8rem;
  font-weight: 500;
}
.prompts-auth p {
  font-size: 0.72rem;
  margin-top: 0.25rem;
  color: var(--text-soft);
}
.prompts-auth button {
  min-height: 40px;
  color: var(--accent-text);
  font-size: 0.75rem;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
