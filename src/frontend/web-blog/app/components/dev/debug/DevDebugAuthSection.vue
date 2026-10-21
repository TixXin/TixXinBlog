<!--
  @file DevDebugAuthSection.vue
  @description Dev 调试面板账号登录态 Tab 分区（用户身份查看、快捷登录博主/访客与退出）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="dev-debug-section">
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">isLoggedIn</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip" :class="isLoggedIn ? 'dev-debug-chip--ok' : 'dev-debug-chip--muted'">
          {{ isLoggedIn ? 'true' : 'false' }}
        </span>
      </span>
    </div>
    <template v-if="currentUser">
      <div class="dev-debug-row">
        <span class="dev-debug-row__label">role</span>
        <span class="dev-debug-row__value">
          <span class="dev-debug-chip" :class="`dev-debug-chip--role-${currentUser.role}`">
            {{ currentUser.role }}
          </span>
        </span>
      </div>
      <div class="dev-debug-row">
        <span class="dev-debug-row__label">nickname</span>
        <span class="dev-debug-row__value dev-debug-row__value--mono">
          {{ currentUser.nickname }}
        </span>
      </div>
      <div class="dev-debug-row">
        <span class="dev-debug-row__label">email</span>
        <span class="dev-debug-row__value dev-debug-row__value--mono">
          {{ currentUser.email }}
        </span>
      </div>
      <div class="dev-debug-row">
        <span class="dev-debug-row__label">id</span>
        <span class="dev-debug-row__value dev-debug-row__value--mono">
          {{ currentUser.id }}
        </span>
      </div>
    </template>

    <div class="dev-debug-divider" />

    <div class="dev-debug-actions dev-debug-actions--column">
      <button
        type="button"
        class="dev-debug-btn"
        :class="{ 'is-active': currentUser?.role === 'owner' }"
        @click="loginAs('owner')"
      >
        <Icon name="lucide:crown" size="13" />
        <span>登录为博主</span>
      </button>
      <button
        type="button"
        class="dev-debug-btn"
        :class="{ 'is-active': currentUser?.role === 'visitor' }"
        @click="loginAs('visitor')"
      >
        <Icon name="lucide:user-round" size="13" />
        <span>登录为访客</span>
      </button>
      <button type="button" class="dev-debug-btn dev-debug-btn--danger" :disabled="!isLoggedIn" @click="onLogout">
        <Icon name="lucide:log-out" size="13" />
        <span>退出登录</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const { currentUser, isLoggedIn, logout } = useCurrentUser()
const { open: openRealLogin } = useLoginDrawer()
const { info } = useToast()

async function loginAs(role: 'owner' | 'visitor') {
  if (role === 'owner') openRealLogin('login')
  else await logout()
}

async function onLogout() {
  try {
    await logout()
    info('已退出登录')
  } catch {
    info('退出失败，请重试')
  }
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/dev-debug' as devDebug;

@include devDebug.shared-styles;
</style>
