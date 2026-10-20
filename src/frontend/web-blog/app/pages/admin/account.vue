<!--
  @file account.vue
  @description 管理员账号安全：改密后清除当前登录，并撤销所有旧会话。
-->
<template>
  <section class="account">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-system.account.title') }}</h1>
      </div>
    </header>
    <ClientOnly>
      <p v-if="profile">
        {{ t('admin-system.account.currentAccount') }}<strong>{{ profile.username }}</strong>
      </p>
      <p v-if="profile?.lastLoginAt">
        {{ t('admin-system.account.lastLogin', { time: formatDateTime(profile.lastLoginAt, { hour12: false }) }) }}
      </p>
      <p v-if="loadError" role="alert">
        {{ loadError }} <button type="button" @click="load">{{ t('admin-system.account.retry') }}</button>
      </p>
      <form class="account__password" @submit.prevent="changePassword">
        <h2>{{ t('admin-system.account.passwordTitle') }}</h2>
        <p>{{ t('admin-system.account.passwordHint') }}</p>
        <fieldset :disabled="pending || sessions.pending.value || !profile || !isLoggedIn">
          <label
            >{{ t('admin-system.account.currentPassword')
            }}<input v-model="currentPassword" type="password" autocomplete="current-password" maxlength="128" required
          /></label>
          <label
            >{{ t('admin-system.account.newPassword')
            }}<input
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
          /></label>
          <label
            >{{ t('admin-system.account.confirmPassword')
            }}<input
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
          /></label>
          <p v-if="error" role="alert">{{ error }}</p>
          <button type="submit">
            {{ pending ? t('admin-system.account.submitting') : t('admin-system.account.submit') }}
          </button>
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
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.account.title'), robots: 'noindex, nofollow' })
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
    loadError.value = t('admin-system.account.loadFailed')
  }
}
async function changePassword() {
  if (pending.value) return
  error.value = ''
  if (newPassword.value !== confirmation.value) {
    error.value = t('admin-system.account.mismatch')
    return
  }
  if (newPassword.value === currentPassword.value) {
    error.value = t('admin-system.account.samePassword')
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
    success(t('admin-system.account.changed'))
    await navigateTo({ path: '/admin/login', query: { changed: '1' } })
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'admin-system.account.changeUncertain')
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
  min-width: 0;
  max-width: 680px;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin: 0.75rem 0;
}
.account__password {
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 1.5rem;
  border-radius: 1rem;
  margin-top: 1.5rem;
}
fieldset {
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: 0;
  border: 0;
}
label {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
}

fieldset:disabled {
  opacity: 0.6;
}
@media (max-width: 760px) {
  .account__password {
    padding: 1rem;
  }
}
</style>
