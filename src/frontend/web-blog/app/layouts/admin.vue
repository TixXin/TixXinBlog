<!--
  @file admin.vue
  @description 博主管理布局，提供明确的内容管理导航和真实退出操作
-->
<template>
  <div class="admin-shell" :class="{ 'admin-shell--login': isLogin }">
    <aside v-if="!isLogin" class="admin-sidebar">
      <NuxtLink class="admin-brand" to="/admin"><Icon name="lucide:notebook-pen" />TixXin 管理</NuxtLink>
      <nav ref="sidebarNav" aria-label="管理导航">
        <NuxtLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="{ 'is-active': activePath === item.path }"
          :aria-current="activePath === item.path ? 'page' : undefined"
          ><Icon :name="item.icon" />{{ item.label }}</NuxtLink
        >
      </nav>
      <NuxtLink class="admin-back" to="/"><Icon name="lucide:arrow-up-right" />返回博客</NuxtLink>
    </aside>
    <header class="admin-header">
      <nav aria-label="面包屑">
        <NuxtLink :to="isLogin ? '/' : '/admin'">{{ isLogin ? '返回博客' : '后台' }}</NuxtLink
        ><span aria-hidden="true">/</span><span>{{ pageTitle }}</span>
      </nav>
      <ClientOnly
        ><button type="button" aria-label="切换明暗主题" @click="toggleColor">
          <Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" /></button
        ><button v-if="isLoggedIn" type="button" :disabled="leaving" @click="leave">退出登录</button></ClientOnly
      >
    </header>
    <main class="admin-main">
      <ClientOnly><p v-if="restoringPending" role="status">正在确认登录状态…</p></ClientOnly>
      <ClientOnly
        ><section v-if="!isLogin && authError" class="admin-session" aria-label="登录状态提示">
          <p role="alert">{{ authError }}</p>
          <AuthLoginForm
            v-if="!isLoggedIn"
            @authenticated="reauthenticated"
            @switch-view="sessionHelp = !sessionHelp"
          />
          <p v-if="sessionHelp">请使用博主账号重新登录；当前页面不会跳转，未保存内容保留。</p>
        </section></ClientOnly
      >
      <NuxtPage />
    </main>
  </div>
</template>
<script setup lang="ts">
const { isLoggedIn, logout, authError, restoringPending } = useCurrentUser()
const sessionHelp = ref(false)
function reauthenticated() {
  sessionHelp.value = false
}
const { error } = useToast()
const route = useRoute()
const sidebarNav = ref<HTMLElement | null>(null)
async function revealActiveNavigation() {
  await nextTick()
  sidebarNav.value
    ?.querySelector<HTMLElement>('[aria-current="page"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
onMounted(revealActiveNavigation)
watch(() => route.path, revealActiveNavigation)
const colorMode = useColorMode()
const leaving = ref(false)
const navigation = [
  { path: '/admin', label: '管理概览', icon: 'lucide:layout-dashboard' },
  { path: '/admin/posts', label: '文章管理', icon: 'lucide:files' },
  { path: '/admin/comments', label: '评论管理', icon: 'lucide:messages-square' },
  { path: '/admin/flashes', label: '闪念管理', icon: 'lucide:lightbulb' },
  { path: '/admin/moments', label: '朋友圈管理', icon: 'lucide:messages-square' },
  { path: '/admin/guestbook', label: '留言管理', icon: 'lucide:message-circle' },
  { path: '/admin/gallery', label: '图库管理', icon: 'lucide:camera' },
  { path: '/admin/projects', label: '项目管理', icon: 'lucide:layers' },
  { path: '/admin/media', label: '媒体资源', icon: 'lucide:images' },
  { path: '/admin/taxonomy', label: '分类与标签', icon: 'lucide:tags' },
  { path: '/admin/site', label: '站点设置', icon: 'lucide:settings' },
  { path: '/admin/account', label: '账号安全', icon: 'lucide:shield-check' },
  { path: '/admin/audit', label: '操作审计', icon: 'lucide:clipboard-list' },
  { path: '/admin/maintenance', label: '备份与维护', icon: 'lucide:database-backup' },
]
const isLogin = computed(() => route.path === '/admin/login')
const activePath = computed(
  () =>
    navigation
      .slice()
      .reverse()
      .find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))?.path,
)
const pageTitle = computed(() =>
  isLogin.value
    ? '博主登录'
    : route.path === '/admin/posts/new'
      ? '新建文章'
      : /^\/admin\/posts\/\d+$/.test(route.path)
        ? '编辑文章'
        : (navigation.find((item) => item.path === activePath.value)?.label ?? '内容管理'),
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
    error('退出失败，请稍后重试')
  } finally {
    leaving.value = false
  }
}
</script>
<style scoped lang="scss">
.admin-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  height: 100dvh;
  overflow: auto;
  background: var(--surface-1);
  color: var(--text-main);
}
.admin-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.admin-header nav {
  display: flex;
  gap: 1rem;
  flex: 1;
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
  width: 100%;
  min-width: 0;
  max-width: 1200px;
  margin: 0 auto;
  align-self: start;
  padding: 1.5rem;
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
  gap: 2rem;
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
.admin-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.admin-sidebar nav a,
.admin-back {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem;
  border-radius: 0.65rem;
  color: var(--text-muted);
}
.admin-sidebar nav a.is-active {
  color: var(--accent);
  background: var(--surface-3);
  font-weight: 600;
}
.admin-sidebar nav a:hover {
  background: var(--surface-3);
}
.admin-back {
  margin-top: auto;
}
.admin-shell--login {
  grid-template-columns: minmax(0, 1fr);
}
@media (max-width: 760px) {
  .admin-shell {
    display: block;
  }
  .admin-sidebar {
    padding: 1rem;
    gap: 0.8rem;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .admin-sidebar nav {
    flex-direction: row;
    overflow-x: auto;
  }
  .admin-sidebar nav a {
    white-space: nowrap;
    flex-shrink: 0;
  }
  .admin-back {
    display: none;
  }
  .admin-header {
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }
  .admin-header nav {
    gap: 0.5rem;
  }
  .admin-main {
    padding: 1rem;
  }
}
</style>
