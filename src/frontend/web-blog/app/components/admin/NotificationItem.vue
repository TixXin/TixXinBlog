<!--
  @file NotificationItem.vue
  @description 单条通知卡片：显示通知类型、阅读状态、业务状态、时间与操作链接/标记已读操作。
-->
<template>
  <li :data-notification-id="item.id" tabindex="-1">
    <h2>
      {{ t(`admin-system.notifications.kinds.${item.kind}`)
      }}<span v-if="!item.readAt"> · {{ t('admin-system.notifications.unread') }}</span>
    </h2>
    <p>{{ t(`admin-system.notifications.states.${item.state}`) }} · {{ formatDateTime(item.createdAt) }}</p>
    <div class="notifications__actions">
      <NuxtLink v-if="item.url" :to="item.url">{{ t('admin-system.notifications.viewContent') }}</NuxtLink>
      <span v-else>{{ t('admin-system.notifications.contentGone') }}</span>
      <button v-if="!item.readAt" type="button" :disabled="disabled" @click="$emit('read', item.id)">
        {{ t('admin-system.notifications.markRead') }}
      </button>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { OwnerNotification } from '~/features/notification/types'

defineProps<{
  item: OwnerNotification
  disabled: boolean
}>()

defineEmits<{
  (e: 'read', id: string): void
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
li {
  position: relative;
  min-width: 0;
  padding: 0.875rem 1rem;
  border: 1px solid var(--admin-card-border);
  border-radius: 0.5rem;
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  &:hover {
    border-color: var(--border-hover);
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
h2 {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
p {
  margin-block: 0.375rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.notifications__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-block: 0.75rem;

  a {
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
}
@media (max-width: 640px) {
  .notifications__actions > span {
    flex: 1 1 100%;
  }
}
</style>
