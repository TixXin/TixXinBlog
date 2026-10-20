<!--
  @file admin.vue
  @description 博主管理布局，提供明确的内容管理导航和真实退出操作
-->
<template>
  <div class="admin-shell" :class="{ 'admin-shell--login': isLogin, 'admin-shell--setup': isSetup }">
    <aside v-if="!isLogin" class="admin-sidebar">
      <NuxtLink class="admin-brand" to="/admin"
        ><Icon name="lucide:notebook-pen" />{{ t('admin-system.layout.brand', { name: siteName }) }}</NuxtLink
      >
      <AdminNavigation />
      <NuxtLink class="admin-back" to="/"
        ><Icon name="lucide:arrow-up-right" />{{ t('admin-system.layout.backToBlog') }}</NuxtLink
      >
    </aside>
    <header class="admin-header" :class="{ 'admin-header--bare': isSetup }">
      <CommonContextDrawer
        v-if="!isLogin"
        v-model:open="drawerOpen"
        class="admin-mobile-navigation"
        :label="t('admin-system.nav.label')"
      >
        <AdminNavigation />
        <NuxtLink class="admin-back" to="/"
          >{{ t('admin-system.layout.backToBlog') }}<Icon name="lucide:arrow-up-right"
        /></NuxtLink>
      </CommonContextDrawer>
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
        ><button type="button" :aria-label="t('admin-system.layout.toggleColor')" @click="toggleColor">
          <Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></button
        ><button v-if="isLoggedIn" type="button" :disabled="leaving" @click="leave">
          {{ t('admin-system.layout.logout') }}
        </button></ClientOnly
      >
    </header>
    <main ref="main" class="admin-main" :aria-label="t('admin-system.layout.main')" tabindex="-1">
      <div class="admin-content">
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
  </div>
</template>
<script setup lang="ts">
import { adminNavigation as navigation, adminModule } from '~/features/admin/navigation'
const { t } = useI18n()
// 后台品牌沿用博主维护的站点名，不在布局里写死
const { siteName } = useSiteInfo()
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
function toggleColor() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
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
.admin-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  background: var(--surface-1);
  color: var(--text-main);
}
.admin-header {
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.admin-header--bare {
  justify-content: flex-end;
  background: transparent;
  border-bottom-color: transparent;
}
.admin-header nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}
.admin-header a {
  color: var(--accent);
}
.admin-header button {
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
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
  padding: 1.5rem;
}
.admin-mobile-navigation {
  display: none;
}
.admin-header button {
  min-height: 44px;
}
.admin-jump-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.admin-session {
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 0.75rem;
  max-width: 440px;
  margin-bottom: 1rem;
}
.admin-sidebar {
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
  padding: 1.5rem 1rem;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
}
.admin-sidebar :deep(.admin-navigation) {
  flex: 1;
}
.admin-brand,
.admin-back {
  flex-shrink: 0;
}
.admin-back {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
  padding: 0.75rem;
  color: var(--text-muted);
}
.admin-back {
  margin-top: auto;
}
.admin-shell--login {
  grid-template-columns: minmax(0, 1fr);
}
// 初始化向导透出站点背景与点阵，让卡片与背景分出层次
.admin-shell--setup {
  background: transparent;
}
@media (max-width: 760px) {
  .admin-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-sidebar {
    display: none;
  }
  .admin-mobile-navigation {
    display: block;
  }
  .admin-header {
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .admin-header nav {
    gap: 0.4rem;
    min-width: 0;
    flex-basis: 100%;
    order: 2;
    padding: 0.25rem;
  }
  .admin-content {
    padding: 1rem;
  }
  .admin-main {
    scroll-padding-block: 1rem;
  }
}
</style>
