<!-- @file Navigation.vue @description 桌面与移动共用管理导航：按工作台、内容、互动、站点、系统分组，活动项只滚动导航自身；互动通知显示未读徽章 -->
<template>
  <nav ref="nav" class="admin-navigation" :aria-label="t('admin-system.nav.label')">
    <div
      v-for="group in groups"
      :key="group.id"
      class="admin-navigation__group"
      role="group"
      :aria-labelledby="`${uid}-${group.id}`"
    >
      <p :id="`${uid}-${group.id}`" class="admin-navigation__heading">{{ t(`admin-system.nav.groups.${group.id}`) }}</p>
      <NuxtLink
        v-for="item in group.items"
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
    </div>
  </nav>
</template>
<script setup lang="ts">
import { adminNavigation, adminNavigationGroups, adminModule } from '~/features/admin/navigation'
const { t } = useI18n()
const uid = useId()
const groups = adminNavigationGroups.map((id) => ({ id, items: adminNavigation.filter((item) => item.group === id) }))
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
  gap: 1rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  &__heading {
    margin: 0 0 0.25rem;
    padding: 0 0.625rem;
    color: var(--text-soft);
    font-size: 0.75rem;
    font-weight: 600;
  }
  a {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      :deep(.iconify),
      :deep(svg) {
        transition: none;
      }
    }
    :deep(.iconify),
    :deep(svg) {
      flex-shrink: 0;
      font-size: 1rem;
      color: var(--text-soft);
      transition: color 0.15s ease;
    }
    &:hover {
      background: var(--surface-2);
      color: var(--text-main);

      :deep(.iconify),
      :deep(svg) {
        color: var(--text-main);
      }
    }
    &[aria-current='page'] {
      background: var(--surface-2);
      color: var(--text-main);
      font-weight: 600;
      box-shadow: inset 0 0 0 1px var(--border-soft);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0.375rem;
        bottom: 0.375rem;
        width: 3px;
        border-radius: 0 2px 2px 0;
        background: var(--accent-action);
      }

      :deep(.iconify),
      :deep(svg) {
        color: var(--accent-action);
      }
    }
    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  }
  &__badge {
    margin-left: auto;
    min-width: 1.25rem;
    padding: 0.0625rem 0.375rem;
    border-radius: 999px;
    background: var(--accent-action);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  }
}
@media (pointer: coarse) {
  .admin-navigation a {
    min-height: 44px;
  }
}
</style>
