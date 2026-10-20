<!--
  @file admin.vue
  @description 博主管理布局：桌面为分组侧栏 + 顶栏 + 独立滚动的内容区，移动端为顶栏 + 内容区 + 底部标签栏；
               提供面包屑、表单操作跳转、明暗切换与真实退出操作
-->
<template>
  <div class="admin-shell" :class="{ 'admin-shell--login': isLogin, 'admin-shell--setup': isSetup }">
    <AdminShellSidebar v-if="!isLogin" />
    <header class="admin-header" :class="{ 'admin-header--bare': isSetup }">
      <nav v-if="!isSetup" :aria-label="t('admin-system.layout.breadcrumb')">
        <NuxtLink :to="isLogin ? '/' : '/admin'">{{
          isLogin ? t('admin-system.layout.backToBlog') : t('admin-system.layout.breadcrumbRoot')
        }}</NuxtLink
        ><span aria-hidden="true">/</span><span>{{ pageTitle }}</span>
      </nav>
      <button v-if="actionTarget" type="button" class="admin-jump-actions" @click="jumpToActions">
        {{ t('admin-system.layout.jumpToActions') }}<Icon name="lucide:arrow-down-to-line" />
      </button>
      <ClientOnly
        ><button
          type="button"
          class="admin-header__icon"
          :aria-label="t('admin-system.layout.toggleColor')"
          @pointerdown="onToggleColorPointerDown"
          @click="onToggleColorClick"
        >
          <Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></button
        ><button v-if="isLoggedIn" type="button" class="admin-header__logout" :disabled="leaving" @click="leave">
          <Icon name="lucide:log-out" /><span class="admin-header__logout-label">{{
            t('admin-system.layout.logout')
          }}</span>
        </button></ClientOnly
      >
    </header>
    <main ref="main" class="admin-main" :aria-label="t('admin-system.layout.main')" tabindex="-1">
      <!-- admin-ui：后台统一控件外观的作用域（_admin.scss），初始化向导使用自己的表单样式 -->
      <div class="admin-content" :class="{ 'admin-ui': !isSetup }">
        <ClientOnly
          ><p v-if="restoringPending" role="status">{{ t('admin-system.layout.restoring') }}</p></ClientOnly
        >
        <ClientOnly
          ><section
            v-if="!isLogin && authError"
            class="admin-session"
            :aria-label="t('admin-system.layout.sessionNotice')"
          >
            <p role="alert">{{ authError }}</p>
            <AuthLoginForm
              v-if="!isLoggedIn"
              @authenticated="reauthenticated"
              @switch-view="sessionHelp = !sessionHelp"
            />
            <p v-if="sessionHelp">{{ t('admin-system.layout.sessionHelp') }}</p>
          </section></ClientOnly
        >
        <NuxtPage />
      </div>
    </main>
    <AdminShellTabBar v-if="!isLogin" v-model:open="drawerOpen" />
  </div>
</template>
<script setup lang="ts">
import { adminNavigation as navigation, adminModule } from '~/features/admin/navigation'
const { t } = useI18n()
const main = ref<HTMLElement | null>(null)
useAdminWorkspace(main)
const actionTarget = ref<HTMLElement | null>(null)
provide('admin-action-target', actionTarget)
function jumpToActions() {
  actionTarget.value?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  actionTarget.value?.focus({ preventScroll: true })
}
const drawerOpen = ref(false)
let breakpoint: MediaQueryList | undefined
const closeAtDesktop = () => {
  if (breakpoint?.matches) drawerOpen.value = false
}
onMounted(() => {
  breakpoint = window.matchMedia('(min-width: 761px)')
  breakpoint.addEventListener('change', closeAtDesktop)
})
onBeforeUnmount(() => breakpoint?.removeEventListener('change', closeAtDesktop))
const { isLoggedIn, logout, authError, restoringPending } = useCurrentUser()
const sessionHelp = ref(false)
function reauthenticated() {
  sessionHelp.value = false
}
const { error } = useToast()
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)
const { setTheme } = useTheme()
const colorMode = useColorMode()
const leaving = ref(false)
// 登录页与初始化向导都不需要后台导航
const isLogin = computed(() => route.path === '/admin/login' || route.path === '/setup')
// 初始化向导是安装后的第一个页面：不显示面包屑，顶栏只留主题切换
const isSetup = computed(() => route.path === '/setup')
const activePath = computed(() => adminModule(route.path)?.path)
const activeItem = computed(() => navigation.find((item) => item.path === activePath.value))
const pageTitle = computed(() =>
  route.path === '/setup'
    ? t('admin-system.layout.titleSetup')
    : isLogin.value
      ? t('admin-system.layout.titleLogin')
      : route.path === '/admin/posts/new'
        ? t('admin-system.layout.titleNewPost')
        : /^\/admin\/posts\/\d+$/.test(route.path)
          ? t('admin-system.layout.titleEditPost')
          : t(activeItem.value?.labelKey ?? 'admin-system.layout.titleFallback'),
)
let suppressToggleClickUntil = 0
function onToggleColorPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  suppressToggleClickUntil = Date.now() + 400
  const next = colorMode.value === 'dark' ? 'light' : 'dark'
  setTheme(next, e)
}
function onToggleColorClick(e: MouseEvent) {
  if (Date.now() < suppressToggleClickUntil) return
  const next = colorMode.value === 'dark' ? 'light' : 'dark'
  setTheme(next, e)
}
async function leave() {
  if (leaving.value) return
  leaving.value = true
  try {
    await logout()
    await navigateTo('/admin/login')
  } catch {
    error(t('admin-system.layout.logoutFailed'))
  } finally {
    leaving.value = false
  }
}
</script>
<style scoped lang="scss">
@use 'tokens' as *;

.admin-shell {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text-main);
  transition: $transition-colors;
}
.admin-header {
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 3.25rem;
  padding: 0.5rem 1.5rem;
  border-bottom: 1px solid var(--border-soft);
  background: color-mix(in srgb, var(--surface-1) 88%, transparent);
  backdrop-filter: blur(12px);
  transition: $transition-colors;
}
.admin-header--bare {
  position: absolute;
  top: 0;
  right: 0;
  justify-content: flex-end;
  background: transparent;
  border-bottom-color: transparent;
  backdrop-filter: none;
}
.admin-header nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--text-soft);
  font-size: 0.8125rem;

  a {
    color: var(--text-soft);
    text-decoration: none;
    transition: color 0.15s ease;

    &:hover {
      color: var(--text-main);
    }
  }
  span[aria-hidden='true'] {
    color: var(--border-hover);
    font-size: 0.75rem;
  }
  span:last-child {
    color: var(--text-main);
    font-weight: 600;
  }
}
.admin-header button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 2rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--border-soft);
    color: var(--text-main);
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
.admin-header .admin-header__icon {
  width: 2rem;
  padding: 0;
}
.admin-header .admin-header__logout:hover:not(:disabled) {
  color: var(--danger-text);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger) 25%, transparent);
}
.admin-main {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scroll-padding-block: 1rem 10rem;
  outline: none;
}
.admin-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.75rem 1.5rem 3rem;
}
.admin-session {
  max-width: 440px;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-1);
}
// 初始化向导与登录页透出站点背景与点阵，让卡片与背景分出层次
.admin-shell--login,
.admin-shell--setup {
  position: relative;
  background: transparent;
}
.admin-shell--login {
  grid-template-columns: minmax(0, 1fr);

  .admin-header {
    background: transparent;
    border-bottom-color: transparent;
    backdrop-filter: none;
  }
}
.admin-shell--setup {
  grid-template-rows: minmax(0, 1fr);
}
@media (pointer: coarse) {
  .admin-header button {
    min-height: 44px;
  }
  .admin-header .admin-header__icon {
    width: 44px;
  }
}
@media (max-width: 760px) {
  .admin-shell:not(.admin-shell--login) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .admin-header {
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
  }
  .admin-header nav {
    gap: 0.375rem;
  }
  // 窄屏退出按钮只留图标，名称保留给读屏
  .admin-header__logout-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .admin-content {
    padding: 1rem 1rem 2rem;
  }
  .admin-main {
    scroll-padding-block: 1rem;
  }
}
</style>
