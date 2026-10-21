<!--
  @file NotificationDetail.vue
  @description 选中的通知高亮卡片：支持定位、阅读状态、业务状态、跳转内容与标记已读。
-->
<template>
  <section
    ref="panel"
    class="notifications__focused"
    :aria-label="t('admin-system.notifications.focused')"
    :data-focused-notification-id="notification.id"
    tabindex="-1"
  >
    <h2>
      {{ t('admin-system.notifications.focused') }} · {{ t(`admin-system.notifications.kinds.${notification.kind}`)
      }}<span v-if="!notification.readAt"> · {{ t('admin-system.notifications.unread') }}</span>
    </h2>
    <p>
      {{ t(`admin-system.notifications.states.${notification.state}`) }} · {{ formatDateTime(notification.createdAt) }}
    </p>
    <div class="notifications__actions">
      <NuxtLink v-if="notification.url" :to="notification.url">{{
        t('admin-system.notifications.viewContent')
      }}</NuxtLink>
      <span v-else>{{ t('admin-system.notifications.contentGone') }}</span>
      <button v-if="!notification.readAt" type="button" :disabled="disabled" @click="$emit('read', notification.id)">
        {{ t('admin-system.notifications.markRead') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OwnerNotification } from '~/features/notification/types'

defineProps<{
  notification: OwnerNotification
  disabled: boolean
}>()

defineEmits<{
  (e: 'read', id: string): void
}>()

const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)

function focus() {
  panel.value?.focus()
  panel.value?.scrollIntoView({ block: 'nearest' })
}

defineExpose({ focus, panel })
</script>

<style scoped lang="scss">
.notifications__focused {
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
