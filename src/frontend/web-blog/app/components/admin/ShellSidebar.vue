<!--
  @file ShellSidebar.vue
  @description 后台桌面侧栏：站点头像与名称、分组导航、返回博客；导航独立滚动，品牌与底部入口固定
-->
<template>
  <aside class="admin-sidebar">
    <NuxtLink class="admin-brand" to="/admin">
      <img v-if="ownerCard.avatar" class="admin-brand__avatar" :src="ownerCard.avatar" alt="" />
      <span v-else class="admin-brand__avatar admin-brand__avatar--icon"><Icon name="lucide:notebook-pen" /></span>
      <span class="admin-brand__text">
        <strong>{{ siteName }}</strong>
        <small>{{ t('admin-system.layout.brandSuffix') }}</small>
      </span>
    </NuxtLink>
    <AdminNavigation />
    <NuxtLink class="admin-back" to="/"
      ><Icon name="lucide:arrow-up-right" />{{ t('admin-system.layout.backToBlog') }}</NuxtLink
    >
  </aside>
</template>

<script setup lang="ts">
const { t } = useI18n()
// 品牌沿用博主维护的站点名与头像，不在布局里写死
const { siteName, ownerCard } = useSiteInfo()
</script>

<style scoped lang="scss">
.admin-sidebar {
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 0;
  overflow: hidden;
  padding: 1.25rem 0.75rem 1rem;
  border-right: 1px solid var(--border-soft);
  background: var(--surface-1);

  :deep(.admin-navigation) {
    flex: 1;
  }
}
.admin-brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.75rem;
  color: var(--text-main);
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  &__avatar {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.75rem;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--border-soft);

    &--icon {
      display: grid;
      place-items: center;
      background: var(--accent-soft);
      color: var(--accent-text);
    }
  }
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.3;

    strong {
      overflow: hidden;
      font-size: 0.9375rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    small {
      color: var(--text-soft);
      font-size: 0.75rem;
    }
  }
}
.admin-back {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-soft);
  border-radius: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
  text-decoration: none;

  &:hover {
    color: var(--text-main);
  }
}
@media (max-width: 760px) {
  .admin-sidebar {
    display: none;
  }
}
</style>
