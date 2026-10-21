<!--
  @file SubscriptionSourceNav.vue
  @description 订阅页面来源切换（博客公开/本机私有）与币种快捷切换导航
  @author TixXin
  @since 2026-04-20
-->

<template>
  <nav class="subscription-source" :aria-label="$t('misc.subscription.page.sourceLabel')">
    <button type="button" :aria-pressed="mode === 'blog'" @click="$emit('switch-mode', 'blog')">
      {{ $t('misc.subscription.page.sourceBlog') }}
    </button>
    <button type="button" :aria-pressed="mode === 'local'" @click="$emit('switch-mode', 'local')">
      {{ $t('misc.subscription.page.sourceLocal') }}<span> · {{ $t('misc.subscription.page.sourceLocalHint') }}</span>
    </button>
    <button
      v-if="mode === 'local' && !editing"
      type="button"
      class="subscription-add-entry"
      :aria-label="$t('misc.subscription.page.addLocalLabel')"
      :disabled="!localReady"
      @click="$emit('add-local')"
    >
      <Icon name="lucide:plus" size="18" /><span>{{ $t('misc.subscription.page.addLocal') }}</span>
    </button>
    <NuxtLink v-if="mode === 'blog' && isLoggedIn" to="/admin/subscriptions">{{
      $t('misc.subscription.page.manage')
    }}</NuxtLink>
  </nav>
  <p v-if="mode === 'local'" class="subscription-note subscription-local-note">
    {{ $t('misc.subscription.page.localNote') }}
  </p>
  <nav class="subscription-currencies" :aria-label="$t('misc.subscription.page.currencyLabel')">
    <button
      v-for="code in currencyOptions"
      :key="code"
      type="button"
      :aria-pressed="currency === code"
      :disabled="!controlsReady"
      @click="$emit('change-currency', code)"
    >
      {{ code }}
    </button>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'blog' | 'local'
  editing?: boolean
  localReady?: boolean
  isLoggedIn?: boolean
  currencyOptions: readonly string[]
  currency: string
  controlsReady: boolean
}>()

defineEmits<{
  'switch-mode': [mode: 'blog' | 'local']
  'add-local': []
  'change-currency': [code: string]
}>()
</script>

<style scoped lang="scss">
@use '~/features/subscription/styles';

.subscription-source {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.subscription-source button {
  padding-inline: 1rem;
}
.subscription-source button[aria-pressed='true'] {
  border-color: var(--accent-text);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.subscription-source .subscription-add-entry {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.subscription-source a {
  margin-left: auto;
  font-size: 0.875rem;
}
.subscription-local-note {
  margin: -0.75rem 0 0;
}
.subscription-currencies {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}
.subscription-currencies button {
  min-width: 0;
  padding-inline: 0.35rem;
}
.subscription-currencies button[aria-pressed='true'] {
  background: var(--accent-action);
  border-color: var(--accent-action);
  color: #fff;
}
@media (max-width: 640px) {
  .subscription-source .subscription-add-entry {
    width: 44px;
    flex-shrink: 0;
    padding-inline: 0;
  }
  .subscription-add-entry span {
    display: none;
  }
  .subscription-currencies {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
