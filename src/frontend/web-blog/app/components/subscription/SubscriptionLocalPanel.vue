<!--
  @file SubscriptionLocalPanel.vue
  @description 本机私有订阅新增与编辑表单、冲突解决及保存取消操作面板
  @author TixXin
  @since 2026-04-20
-->

<template>
  <section ref="panel" class="subscription-stack subscription-local-panel">
    <CommonRequestFeedback
      v-if="error"
      compact
      :title="$t('misc.subscription.page.localFailed')"
      :description="error"
      @retry="$emit('retry')"
    />
    <p v-if="notice" role="status">{{ notice }}</p>
    <div v-if="conflict" class="subscription-panel">
      <p>
        {{ $t('misc.subscription.page.conflictBody') }}
      </p>
      <SubscriptionRecovery v-if="latest" :value="subscriptionForm(latest)" />
      <p v-else-if="editingId">{{ $t('misc.subscription.page.conflictDeleted') }}</p>
      <button type="button" @click="$emit('merge')">{{ $t('misc.subscription.page.mergeLatest') }}</button>
    </div>
    <form v-if="editing" class="subscription-panel subscription-stack" @submit.prevent="$emit('save')">
      <h2>
        {{ editingId ? $t('misc.subscription.page.editLocal') : $t('misc.subscription.page.addLocalLabel') }}
      </h2>
      <SubscriptionFields
        :value="form"
        :disabled="!ready || saving"
        :changed="priceChanged"
        @change="$emit('update-form', $event)"
      />
      <div class="subscription-row">
        <button type="submit" :disabled="!ready || saving || conflict" :aria-busy="saving">
          {{ saving ? $t('misc.subscription.editor.saving') : $t('misc.subscription.page.saveLocal') }}
        </button>
        <button type="button" :disabled="saving" @click="$emit('cancel')">
          {{ $t('misc.subscription.editor.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { SubscriptionForm } from '~/features/subscription/types'
import type { LocalSubscription } from '~/features/subscription/local'
import { subscriptionForm } from '~/features/subscription/editor'

defineProps<{
  error?: string
  notice?: string
  conflict?: boolean
  latest?: LocalSubscription | null
  editingId?: string | null
  editing?: boolean
  form: SubscriptionForm
  ready?: boolean
  saving?: boolean
  priceChanged?: boolean
}>()

defineEmits<{
  retry: []
  merge: []
  save: []
  cancel: []
  'update-form': [value: Partial<SubscriptionForm>]
}>()

const panel = ref<HTMLElement | null>(null)

function focusName() {
  panel.value?.scrollIntoView({ block: 'start' })
  panel.value?.querySelector<HTMLInputElement>('input[data-subscription-field="name"]')?.focus({ preventScroll: true })
}

defineExpose({
  focusName,
  scrollIntoView: (options?: ScrollIntoViewOptions) => panel.value?.scrollIntoView(options),
})
</script>

<style scoped lang="scss">
@use '~/features/subscription/styles';

.subscription-local-panel {
  scroll-margin-top: 1rem;
}
</style>
