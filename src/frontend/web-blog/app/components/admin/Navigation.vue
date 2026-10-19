<!-- @file Navigation.vue @description 桌面与移动共用管理导航，活动项只滚动导航自身；互动通知显示未读徽章 -->
<template>
  <nav ref="nav" class="admin-navigation" :aria-label="t('admin-system.nav.label')">
    <NuxtLink
      v-for="item in adminNavigation"
      :key="item.path"
      :to="item.path"
      tabindex="0"
      :aria-current="activePath === item.path ? 'page' : undefined"
    >
      <Icon :name="item.icon" />{{ t(item.labelKey)
      }}<span v-if="item.path === '/admin/notifications' && unread" class="admin-navigation__badge"
        ><span aria-hidden="true">{{ unread > 99 ? '99+' : unread }}</span
        ><span class="sr-only">{{ t('admin-system.nav.unread', { count: unread }) }}</span></span
      >
    </NuxtLink>
  </nav>
</template>
<script setup lang="ts">
import { adminNavigation, adminModule } from '~/features/admin/navigation'
const { t } = useI18n()
const route = useRoute()
const nav = ref<HTMLElement | null>(null)
const activePath = computed(() => adminModule(route.path)?.path)
const { unread, refresh: refreshUnread } = useAdminNotificationUnread()
const auth = useCurrentUser()
async function reveal() {
  await nextTick()
  let parent = nav.value
  const active = parent?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!parent || !active) return
  // 抽屉由外层内容区滚动；只调整最近可滚动祖先，避免带动后台主内容。
  while (
    parent &&
    !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY))
  )
    parent = parent.parentElement
  if (!parent) return
  const box = parent.getBoundingClientRect(),
    item = active.getBoundingClientRect()
  if (item.top < box.top) parent.scrollTop += item.top - box.top
  else if (item.bottom > box.bottom) parent.scrollTop += item.bottom - box.bottom
}
onMounted(() => {
  void reveal()
  void refreshUnread(false)
})
watch(activePath, reveal)
// 切换后台页面时按需刷新（60 秒内复用），登录恢复后立即读取。
watch(
  () => route.path,
  () => void refreshUnread(false),
)
watch(auth.isLoggedIn, (value) => {
  if (value) void refreshUnread()
  else unread.value = null
})
</script>
<style scoped lang="scss">
.admin-navigation {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  a {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem;
    min-height: 44px;
    border-radius: 0.65rem;
    color: var(--text-muted);
    text-decoration: none;
    &:hover {
      background: var(--surface-3);
    }
    &[aria-current='page'] {
      color: var(--accent);
      background: var(--surface-3);
      font-weight: 600;
    }
    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  }
  &__badge {
    margin-left: auto;
    min-width: 1.5rem;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--accent);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
  }
}
</style>
