<!--
  @file ShellTabBar.vue
  @description 后台移动端底部标签栏：固定高频入口（概览、通知、文章、评论）与「更多」，
               「更多」打开完整的管理导航抽屉；通知显示未读徽章，底部留出安全区
-->
<template>
  <nav class="admin-tabbar" :aria-label="t('admin-system.nav.tabsLabel')">
    <NuxtLink
      v-for="item in adminTabNavigation"
      :key="item.path"
      class="admin-tabbar__item"
      :to="item.path"
      :aria-current="activePath === item.path ? 'page' : undefined"
    >
      <span class="admin-tabbar__icon">
        <Icon :name="item.icon" />
        <span v-if="item.path === '/admin/notifications' && unread" class="admin-tabbar__badge" aria-hidden="true">{{
          unread > 99 ? '99+' : unread
        }}</span>
      </span>
      <span>{{ t(item.tabKey!) }}</span>
      <span v-if="item.path === '/admin/notifications' && unread" class="sr-only">{{
        t('admin-system.nav.unread', { count: unread })
      }}</span>
    </NuxtLink>
    <CommonContextDrawer
      v-model:open="open"
      class="admin-tabbar__more"
      :class="{ 'is-active': !activeIsTab }"
      icon="lucide:layout-grid"
      :label="t('admin-system.nav.label')"
      :trigger-label="t('admin-system.nav.more')"
    >
      <AdminNavigation />
      <NuxtLink class="admin-tabbar__back" to="/"
        >{{ t('admin-system.layout.backToBlog') }}<Icon name="lucide:arrow-up-right"
      /></NuxtLink>
    </CommonContextDrawer>
  </nav>
</template>

<script setup lang="ts">
import { adminModule, adminTabNavigation } from '~/features/admin/navigation'

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const route = useRoute()
const activePath = computed(() => adminModule(route.path)?.path)
const activeIsTab = computed(() => adminTabNavigation.some((item) => item.path === activePath.value))
const { unread } = useAdminNotificationUnread()
</script>

<style scoped lang="scss">
.admin-tabbar {
  display: none;
}
@media (max-width: 760px) {
  .admin-tabbar {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    padding: 0.25rem 0.25rem calc(0.25rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border-soft);
    background: var(--surface-1);
  }
}
.admin-tabbar__item,
.admin-tabbar__more :deep(.context-entry__button) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.25rem;
  border: 0;
  border-radius: 0.75rem;
  background: none;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
}
.admin-tabbar__item[aria-current='page'],
.admin-tabbar__more.is-active :deep(.context-entry__button) {
  color: var(--accent-text);
  font-weight: 600;
}
.admin-tabbar__more :deep(.context-entry__button .iconify),
.admin-tabbar__more :deep(.context-entry__button svg),
.admin-tabbar__icon :deep(.iconify),
.admin-tabbar__icon :deep(svg) {
  font-size: 1.25rem;
  width: 1.25rem;
  height: 1.25rem;
}
.admin-tabbar__icon {
  position: relative;
  display: inline-flex;
}
.admin-tabbar__badge {
  position: absolute;
  top: -0.25rem;
  left: 0.875rem;
  min-width: 1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1rem;
  text-align: center;
}
.admin-tabbar__back {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-top: 1px solid var(--border-soft);
  color: var(--text-muted);
}
</style>
