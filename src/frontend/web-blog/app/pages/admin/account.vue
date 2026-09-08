<!--
  @file account.vue
  @description 管理员账号安全：改密后清除当前登录，并撤销所有旧会话。
-->
<template>
  <section class="account">
    <h1>账号安全</h1>
    <ClientOnly>
      <p v-if="profile">
        当前账号：<strong>{{ profile.username }}</strong>
      </p>
      <p v-if="profile?.lastLoginAt">
        最近登录：{{ new Date(profile.lastLoginAt).toLocaleString('zh-CN', { hour12: false }) }}
      </p>
      <p v-if="loadError" role="alert">{{ loadError }} <button type="button" @click="load">重试</button></p>
      <form @submit.prevent="changePassword">
        <h2>修改密码</h2>
        <p>使用 12–128 位的新密码。成功后当前及其他设备的旧登录均失效，需要重新登录。</p>
        <fieldset :disabled="pending || sessions.pending.value || !profile || !isLoggedIn">
          <label
            >当前密码<input
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              maxlength="128"
              required
          /></label>
          <label
            >新密码<input
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
          /></label>
          <label
            >确认新密码<input
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
          /></label>
          <p v-if="error" role="alert">{{ error }}</p>
          <button type="submit">{{ pending ? '正在修改…' : '修改密码并退出所有会话' }}</button>
        </fieldset>
      </form>
      <AdminActiveSessions
        :items="sessions.items.value"
        :total="sessions.total.value"
        :page="sessions.page.value"
        :pending="sessions.pending.value"
        :error="sessions.error.value"
        :disabled="pending || !isLoggedIn"
        @load="sessions.load"
        @revoke="sessions.revoke"
        @revoke-others="sessions.revokeOthers"
      />
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '账号安全', robots: 'noindex, nofollow' })
const auth = useCurrentUser()
const { isLoggedIn } = auth
const api = useAdminApi()
const sessions = useAdminSessions()
const { success } = useToast()
const profile = ref<{ username: string; lastLoginAt?: string } | null>(null)
const pending = ref(false)
const error = ref('')
const loadError = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
async function load() {
  loadError.value = ''
  try {
    profile.value = await api('/auth/me')
  } catch {
    loadError.value = '账号信息读取失败，请检查登录后重试'
  }
}
async function changePassword() {
  if (pending.value) return
  error.value = ''
  if (newPassword.value !== confirmation.value) {
    error.value = '两次新密码不一致'
    return
  }
  if (newPassword.value === currentPassword.value) {
    error.value = '新密码不能与当前密码相同'
    return
  }
  pending.value = true
  try {
    await api('/auth/password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    })
    currentPassword.value = newPassword.value = confirmation.value = ''
    await auth.clearSession()
    success('密码已修改，所有旧会话已退出，请使用新密码登录')
    await navigateTo({ path: '/admin/login', query: { changed: '1' } })
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    error.value = typeof message === 'string' ? message : '请求未能确认成功。若旧密码已失效，请使用新密码重新登录'
  } finally {
    pending.value = false
  }
}
onMounted(async () => {
  if (await auth.restore()) await Promise.all([load(), sessions.load()])
  else await navigateTo({ path: '/admin/login', query: { next: '/admin/account' } })
})
onBeforeUnmount(() => {
  currentPassword.value = newPassword.value = confirmation.value = ''
})
</script>
<style scoped lang="scss">
.account {
  max-width: 680px;
}
h1 {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin: 0.75rem 0;
}
form {
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 1.5rem;
  border-radius: 1rem;
  margin-top: 1.5rem;
}
fieldset {
  display: grid;
  gap: 1rem;
  padding: 0;
  border: 0;
}
label {
  display: grid;
  gap: 0.5rem;
}
input,
button {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
  min-width: 0;
}
button {
  cursor: pointer;
}
fieldset:disabled {
  opacity: 0.6;
}
</style>
