<!-- @file Editor.vue @description 后台和前台内联共用订阅编辑工作流，复用版本冲突与恢复副本机制 -->
<template>
  <form ref="editorForm" class="subscription-ui subscription-stack" @submit.prevent="save(editor.form.status)">
    <header class="subscription-row">
      <h1 v-if="!inline">{{ editor.id.value ? '编辑订阅' : '新建订阅' }}</h1>
      <h2 v-else>{{ editor.id.value ? '编辑平台订阅' : '记录平台订阅' }}</h2>
      <AdminBackLink v-if="!inline" to="/admin/subscriptions">返回订阅管理</AdminBackLink
      ><button v-if="inline" type="button" :disabled="editor.saving.value || editor.loading.value" @click="cancel">
        取消编辑
      </button>
    </header>
    <section v-if="editor.ownershipLost.value" class="subscription-panel" aria-label="订阅编辑输入已锁定" role="status">
      <h2>身份或内容库已变化</h2>
      <p>私密字段和恢复内容已隐藏。输入按原账号与内容库保留，恢复正确身份后才能继续查看。</p>
      <p v-if="editor.requiresReload.value">
        服务器确认内容库已变化，请刷新整个页面后重新核对当前数据。原归属的副本会独立保留。
      </p>
      <p v-if="editor.localError.value" role="alert">恢复副本暂时无法保存，请保留此窗口。</p>
      <div class="subscription-row">
        <NuxtLink to="/admin/login">重新登录</NuxtLink
        ><button v-if="!editor.requiresReload.value" type="button" @click="editor.load()">重新核对身份与内容库</button>
      </div>
    </section>
    <template v-else>
      <p v-if="editor.error.value" role="alert">
        {{ editor.error.value }}
        <button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.reload">
          重新读取
        </button>
      </p>
      <p v-if="editor.notice.value" role="status">{{ editor.notice.value }}</p>
      <p v-if="editor.localError.value" role="alert">
        {{ editor.localError.value }} <button type="button" @click="editor.persistLocal">重试保存恢复副本</button>
      </p>
      <section v-if="editor.recovery.value" class="subscription-panel" aria-label="订阅恢复副本">
        <h2>发现本标签页未保存的输入</h2>
        <SubscriptionRecovery :value="editor.recovery.value.form" />
        <div class="subscription-row">
          <button
            type="button"
            :disabled="!editor.ready.value || editor.saving.value || editor.loading.value"
            @click="editor.restoreRecovery"
          >
            恢复输入</button
          ><button type="button" @click="editor.discardRecovery">移除恢复副本</button>
        </div>
      </section>
      <section v-if="editor.previousRecoveries.value.length" class="subscription-panel" aria-label="旧内容库恢复副本">
        <h2>另外保留的订阅输入</h2>
        <p>其他内容库的副本仅供核对；媒体需要从当前库重新选择。</p>
        <details v-for="copy in editor.previousRecoveries.value" :key="copy.key">
          <summary>{{ copy.value.form.name || '未命名' }} · {{ copy.value.savedAt }}</summary>
          <SubscriptionRecovery :value="copy.value.form" />
        </details>
      </section>
      <section v-if="editor.serverVersion.value" class="subscription-panel" aria-label="订阅服务器版本">
        <h2>服务器版本 {{ editor.serverVersion.value.revision }}</h2>
        <SubscriptionRecovery :value="subscriptionForm(editor.serverVersion.value)" />
        <div class="subscription-row">
          <button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.reload">
            保留副本并载入服务器版本</button
          ><button type="button" :disabled="editor.saving.value || editor.loading.value" @click="editor.mergeConflict">
            保留输入，按最新版本继续合并
          </button>
        </div>
      </section>
      <p v-if="editor.loading.value" role="status">正在读取订阅…</p>
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
          {{ editor.saving.value ? '正在保存…' : '保存订阅' }}</button
        ><button
          type="button"
          :disabled="!editor.ready.value || editor.saving.value || !editor.form.name.trim()"
          @click="save('draft')"
        >
          保存草稿</button
        ><button
          type="button"
          :disabled="!editor.ready.value || editor.saving.value || !editor.form.name.trim()"
          @click="save('published')"
        >
          发布订阅</button
        ><span>{{
          editor.dirty.value ? '有尚未保存输入' : editor.saved.value ? '当前输入已保存' : '尚未保存'
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
  const input = editorForm.value?.querySelector<HTMLInputElement>('input[aria-label="服务名称"]')
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
      iconMessage.value = result.faviconUrl ? '官网图标已获取。' : '暂未取得图标，保存后使用默认图标。'
    }
  } catch (cause) {
    if (alive) iconMessage.value = `${cause instanceof Error ? cause.message : '图标获取失败'}，仍可保存订阅。`
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
