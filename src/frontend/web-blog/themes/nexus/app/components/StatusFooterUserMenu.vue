<!--
  @file StatusFooterUserMenu.vue
  @description Nexus 底栏用户菜单 popover：快捷导航与退出登录
  @author TixXin
  @since 2026-04-21
-->

<template>
  <Transition name="nexus-user-menu">
    <div v-if="isOpen && isLoggedIn" ref="userMenuRef" class="nexus-bar__user-menu" role="menu">
      <div class="nexus-bar__user-menu-header">
        <div class="nexus-bar__user-menu-name">{{ currentUser?.nickname }}</div>
        <div class="nexus-bar__user-menu-email">{{ currentUser?.email }}</div>
      </div>
      <div class="nexus-bar__user-menu-divider" />
      <button type="button" class="nexus-bar__user-menu-item" role="menuitem" @click="onProfile">
        <Icon name="lucide:user" size="14" />
        <span>{{ $t('theme.nexus.statusBar.profile') }}</span>
      </button>
      <button type="button" class="nexus-bar__user-menu-item" role="menuitem" @click="onSettings">
        <Icon name="lucide:settings" size="14" />
        <span>{{ $t('theme.nexus.statusBar.managePosts') }}</span>
      </button>
      <div class="nexus-bar__user-menu-divider" />
      <button
        type="button"
        class="nexus-bar__user-menu-item nexus-bar__user-menu-item--danger"
        role="menuitem"
        @click="onLogout"
      >
        <Icon name="lucide:log-out" size="14" />
        <span>{{ $t('theme.nexus.statusBar.logout') }}</span>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const { isLoggedIn, currentUser, logout } = useCurrentUser()
const { info } = useToast()
const { t } = useI18n()

const userMenuRef = ref<HTMLElement | null>(null)

function onProfile() {
  emit('close')
  router.push('/about')
}

async function onSettings() {
  emit('close')
  await navigateTo('/admin/posts')
}

async function onLogout() {
  emit('close')
  try {
    await logout()
    info(t('theme.nexus.statusBar.loggedOut'))
  } catch {
    info(t('theme.nexus.statusBar.logoutFailed'))
  }
}

defineExpose({
  menuEl: userMenuRef,
})
</script>

<style lang="scss" scoped>
.nexus-bar__user-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: var(--bar-avatar-pad);
  z-index: 21;
  min-width: 200px;
  padding: 0.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.nexus-bar__user-menu-header {
  padding: 0.5rem 0.625rem 0.625rem;
}

.nexus-bar__user-menu-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.2;
}

.nexus-bar__user-menu-email {
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nexus-bar__user-menu-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.25rem 0;
}

.nexus-bar__user-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    transform: translateX(2px);
  }

  &--danger {
    color: var(--danger, #ef4444);

    &:hover {
      background: rgba(239, 68, 68, 0.08);
      color: var(--danger, #ef4444);
    }
  }
}

.nexus-user-menu-enter-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-user-menu-leave-active {
  transition:
    opacity 0.14s ease-in,
    transform 0.14s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-user-menu-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

.nexus-user-menu-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
</style>
