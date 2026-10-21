<!--
  @file NotificationToolbar.vue
  @description 通知管理工具栏：包含全部/未读筛选控件与前往运行状态的跳转链接。
-->
<template>
  <div class="notifications__toolbar">
    <nav class="notifications__filters" :aria-label="t('admin-system.notifications.filters')">
      <NuxtLink :to="{ query: { filter: 'all' } }" :aria-current="filter === 'all' ? 'page' : undefined">
        {{ t('admin-system.notifications.filterAll') }}
      </NuxtLink>
      <NuxtLink :to="{ query: { filter: 'unread' } }" :aria-current="filter === 'unread' ? 'page' : undefined">
        {{ t('admin-system.notifications.filterUnread') }}
      </NuxtLink>
    </nav>
    <NuxtLink to="/admin/operations" class="notifications__operations-link">
      <Icon name="lucide:arrow-up-right" aria-hidden="true" />
      {{ t('admin-system.notifications.operationsLink') }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  filter: 'all' | 'unread'
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.notifications__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.notifications__filters {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: 0.5rem;
  background: var(--surface-2);

  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.25rem 0.875rem;
    border-radius: 0.375rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
    &:hover {
      color: var(--text-main);
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    &[aria-current='page'] {
      background: var(--surface-1);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      color: var(--text-main);
      font-weight: 600;
    }
  }
}
.notifications__operations-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent-action);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
</style>
