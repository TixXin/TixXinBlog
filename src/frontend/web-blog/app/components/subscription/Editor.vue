<!-- @file Editor.vue @description 后台和前台内联共用订阅编辑工作流，复用版本冲突与恢复副本机制 -->
<template>
  <form ref="editorForm" class="subscription-ui subscription-stack" @submit.prevent="save(editor.form.status)">
    <header class="subscription-row">
      <h1 v-if="!inline">
        {{ editor.id.value ? $t('misc.subscription.editor.editTitle') : $t('misc.subscription.editor.createTitle') }}
      </h1>
      <h2 v-else>
        {{
          editor.id.value
            ? $t('misc.subscription.editor.inlineEditTitle')
            : $t('misc.subscription.editor.inlineCreateTitle')
        }}
      </h2>
      <AdminBackLink v-if="!inline" to="/admin/subscriptions">{{ $t('misc.subscription.editor.back') }}</AdminBackLink
      ><button v-if="inline" type="button" :disabled="editor.saving.value || editor.loading.value" @click="cancel">
        {{ $t('misc.subscription.editor.cancel') }}
      </button>
    </header>
    <section
      v-if="editor.ownershipLost.value"
      class="subscription-panel"
      :aria-label="$t('misc.subscription.editor.lockedLabel')"
      role="status"
    >
      <h2>{{ $t('misc.subscription.editor.lockedTitle') }}</h2>
      <p>{{ $t('misc.subscription.editor.lockedBody') }}</p>
      <p v-if="editor.requiresReload.value">
        {{ $t('misc.subscription.editor.lockedReload') }}
      </p>
      <p v-if="editor.localError.value" role="alert">{{ $t('misc.subscription.editor.lockedLocalError') }}</p>
      <div class="subscription-row">
        <NuxtLink to="/admin/login">{{ $t('misc.subscription.editor.relogin') }}</NuxtLink
        ><button v-if="!editor.requiresReload.value" type="button" @click="editor.load()">
          {{ $t('misc.subscription.editor.recheck') }}
        </button>
      </div>
    </section>
    <template v-else>
      <p v-if="editor.error.value" role="alert">
        {{ editor.error.value }}
        <button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.reload">
          {{ $t('misc.subscription.editor.reload') }}
        </button>
      </p>
      <p v-if="editor.notice.value" role="status">{{ editor.notice.value }}</p>
      <p v-if="editor.localError.value" role="alert">
        {{ editor.localError.value }}
        <button type="button" @click="editor.persistLocal">{{ $t('misc.subscription.editor.retryLocal') }}</button>
      </p>
      <section
        v-if="editor.recovery.value"
        class="subscription-panel"
        :aria-label="$t('misc.subscription.editor.recoveryLabel')"
      >
        <h2>{{ $t('misc.subscription.editor.recoveryTitle') }}</h2>
        <SubscriptionRecovery :value="editor.recovery.value.form" />
        <div class="subscription-row">
          <button
            type="button"
            :disabled="!editor.ready.value || editor.saving.value || editor.loading.value"
            @click="editor.restoreRecovery"
          >
            {{ $t('misc.subscription.editor.restore') }}</button
          ><button type="button" @click="editor.discardRecovery">
            {{ $t('misc.subscription.editor.discardRecovery') }}
          </button>
        </div>
      </section>
      <section
        v-if="editor.previousRecoveries.value.length"
        class="subscription-panel"
        :aria-label="$t('misc.subscription.editor.previousLabel')"
      >
        <h2>{{ $t('misc.subscription.editor.previousTitle') }}</h2>
        <p>{{ $t('misc.subscription.editor.previousBody') }}</p>
        <details v-for="copy in editor.previousRecoveries.value" :key="copy.key">
          <summary>
            {{ copy.value.form.name || $t('misc.subscription.editor.untitled') }} · {{ copy.value.savedAt }}
          </summary>
          <SubscriptionRecovery :value="copy.value.form" />
        </details>
      </section>
      <section
        v-if="editor.serverVersion.value"
        class="subscription-panel"
        :aria-label="$t('misc.subscription.editor.serverLabel')"
      >
        <h2>{{ $t('misc.subscription.editor.serverTitle', { revision: editor.serverVersion.value.revision }) }}</h2>
        <SubscriptionRecovery :value="subscriptionForm(editor.serverVersion.value)" />
        <div class="subscription-row">
          <button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.reload">
            {{ $t('misc.subscription.editor.loadServer') }}</button
          ><button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.mergeConflict">
            {{ $t('misc.subscription.editor.mergeServer') }}
          </button>
        </div>
      </section>
      <p v-if="editor.loading.value" role="status">{{ $t('misc.subscription.editor.loading') }}</p>
      <SubscriptionFields
        :value="editor.form"
        managed
        :disabled="!editor.ready.value || editor.loading.value || editor.saving.value"
        :changed="priceChanged(editor.form, editor.saved.value)"
        :fetching-icon="fetchingIcon"
        :favicon-url="faviconUrl ?? editor.saved.value?.faviconUrl"
        :icon-message="iconMessage"
        @change="editor.change"
        @favicon="fetchIcon"
      />
      <SubscriptionHistory v-if="editor.saved.value" :history="editor.saved.value.priceHistory" />
      <AdminActionBar
        ><button
          type="submit"
          :disabled="!editor.ready.value || editor.saving.value || !editor.form.name.trim()"
          :aria-busy="editor.saving.value"
        >
          {{
            editor.saving.value ? $t('misc.subscription.editor.saving') : $t('misc.subscription.editor.save')
          }}</button
        ><button
          type="button"
          :disabled="!editor.ready.value || editor.saving.value || !editor.form.name.trim()"
          @click="save('draft')"
        >
          {{ $t('misc.subscription.editor.saveDraft') }}</button
        ><button
          type="button"
          :disabled="!editor.ready.value || editor.saving.value || !editor.form.name.trim()"
          @click="save('published')"
        >
          {{ $t('misc.subscription.editor.publish') }}</button
        ><span>{{
          editor.dirty.value
            ? $t('misc.subscription.editor.dirty')
            : editor.saved.value
              ? $t('misc.subscription.editor.savedState')
              : $t('misc.subscription.editor.unsaved')
        }}</span></AdminActionBar
      >
    </template>
  </form>
</template>
<script setup lang="ts">
import { priceChanged, subscriptionForm } from '~/features/subscription/editor'
import type { SubscriptionPublication } from '~/features/subscription/types'
const props = defineProps<{ id: number | null; inline?: boolean }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const editor = useAdminSubscriptionEditor(props.id, { inline: props.inline }),
  repo = useSubscriptionRepository(),
  auth = useCurrentUser(),
  context = useState<string>('page-content-context', () => '')
const fetchingIcon = ref(false),
  iconMessage = ref(''),
  faviconUrl = ref<string | null>(null),
  editorForm = ref<HTMLFormElement | null>(null)
const { t } = useI18n()
let alive = true,
  focusRequested = false
async function focusWhenReady() {
  await nextTick()
  if (!alive || !focusRequested) return
  if (editor.ownershipLost.value) {
    focusRequested = false
    return
  }
  if (!editor.ready.value || editor.loading.value || editor.saving.value) return
  const input = editorForm.value?.querySelector<HTMLInputElement>('input[data-subscription-field="name"]')
  if (!input || input.matches(':disabled')) return
  focusRequested = false
  input.focus({ preventScroll: true })
}
function focusName() {
  focusRequested = true
  void focusWhenReady()
}
// 仅响应页面主动发起的编辑意图，详情异步就绪前不聚焦禁用字段。
watch([editor.ready, editor.loading, editor.saving, editor.ownershipLost], () => void focusWhenReady(), {
  flush: 'post',
})
async function fetchIcon() {
  const url = editor.form.url,
    actor = auth.currentUser.value?.id,
    ownedContext = context.value
  if (!url || fetchingIcon.value) return
  fetchingIcon.value = true
  iconMessage.value = ''
  try {
    const result = await repo.favicon(url)
    if (alive && editor.form.url === url && actor === auth.currentUser.value?.id && ownedContext === context.value) {
      faviconUrl.value = result.faviconUrl
      iconMessage.value = result.faviconUrl
        ? t('misc.subscription.editor.iconFetched')
        : t('misc.subscription.editor.iconMissing')
    }
  } catch (cause) {
    if (alive)
      iconMessage.value = t('misc.subscription.editor.iconFailed', {
        message: cause instanceof Error ? cause.message : t('misc.subscription.editor.iconFailedDefault'),
      })
  } finally {
    if (alive) fetchingIcon.value = false
  }
}
async function save(status: SubscriptionPublication) {
  await editor.save(status)
  if (!editor.error.value && !editor.dirty.value && editor.saved.value) emit('saved')
}
const canLeave = editor.canLeave
function cancel() {
  if (canLeave()) emit('cancel')
}
defineExpose({ canLeave, dirty: editor.dirty, focusName })
onScopeDispose(() => {
  alive = false
  focusRequested = false
})
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
</style>
