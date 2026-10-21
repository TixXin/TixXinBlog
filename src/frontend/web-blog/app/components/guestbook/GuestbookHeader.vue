<!--
  @file GuestbookHeader.vue
  @description 留言板页头：标题、留言总数、博主在线状态、搜索与筛选操作
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="main-content__header">
    <div class="page-title">
      <div class="page-title__icon-wrap" aria-hidden="true"><Icon name="lucide:message-circle" size="18" /></div>
      <div class="page-title__text">
        <h1 class="page-title__heading">{{ t('interaction.guestbook.title') }}</h1>
        <!-- 博主在线状态是信息而非操作，跟在留言数后面，操作区只留搜索 -->
        <p class="page-title__sub guestbook-subline">
          <span>{{ messageCountText }}</span>
          <CommonTooltip :content="ownerPresence.signature || ownerPresence.label">
            <span class="guestbook-presence" :class="`guestbook-presence--${ownerPresence.status}`" tabindex="0"
              ><span class="guestbook-presence__dot" aria-hidden="true" />{{ ownerPresenceText }}</span
            >
          </CommonTooltip>
        </p>
      </div>
    </div>
    <div class="page-actions guestbook-actions">
      <CommonSearchBox
        :model-value="search"
        :label="t('interaction.guestbook.searchLabel')"
        :placeholder="t('interaction.guestbook.searchPlaceholder')"
        @update:model-value="$emit('update:search', $event)"
      />
      <button v-if="search || selectedDate" type="button" class="guestbook-clear" @click="$emit('clearFilters')">
        {{ t('interaction.guestbook.clearFilters') }}
      </button>
      <CommonContextDrawer
        v-if="!rightVisible"
        :open="infoOpen"
        :label="t('interaction.guestbook.infoDrawer')"
        icon="lucide:info"
        @update:open="$emit('update:infoOpen', $event)"
        ><GuestbookOverview
          :data="metadata"
          :pending="metadataPending"
          :error="metadataError?.message"
          @retry="$emit('retryMetadata')"
      /></CommonContextDrawer>
      <NuxtLink v-if="isLoggedIn" to="/admin/guestbook" class="guestbook-clear">{{
        t('interaction.guestbook.manage')
      }}</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GuestbookMetadata } from '~/features/guestbook/types'

defineProps<{
  search: string
  selectedDate: string | null
  messageCountText: string
  metadata: GuestbookMetadata | null
  metadataPending: boolean
  metadataError?: { message?: string } | null
  rightVisible: boolean
  infoOpen: boolean
}>()

defineEmits<{
  'update:search': [value: string]
  'update:infoOpen': [value: boolean]
  clearFilters: []
  retryMetadata: []
}>()

const { t } = useI18n()
const { isLoggedIn } = useCurrentUser()
const { ownerPresence } = useSiteInfo()

const presenceKeys = {
  online: 'interaction.guestbook.ownerOnline',
  idle: 'interaction.guestbook.ownerIdle',
  busy: 'interaction.guestbook.ownerBusy',
  offline: 'interaction.guestbook.ownerOffline',
} as const

const ownerPresenceText = computed(() => t(presenceKeys[ownerPresence.value.status]))
</script>

<style scoped lang="scss">
.guestbook-subline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.guestbook-presence {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  line-height: 1.25rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  white-space: nowrap;
}

.guestbook-presence__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--text-faint);
}

.guestbook-presence--online {
  color: var(--success-text);
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.08);
}

.guestbook-presence--online .guestbook-presence__dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.guestbook-presence--idle {
  color: var(--warning-text);
  border-color: color-mix(in srgb, var(--presence-idle) 35%, transparent);
  background: color-mix(in srgb, var(--presence-idle) 10%, transparent);
}

.guestbook-presence--busy {
  color: var(--danger-text);
  border-color: color-mix(in srgb, var(--presence-busy) 35%, transparent);
  background: color-mix(in srgb, var(--presence-busy) 10%, transparent);
}

.guestbook-presence--idle .guestbook-presence__dot {
  background: var(--presence-idle);
}

.guestbook-presence--busy .guestbook-presence__dot {
  background: var(--presence-busy);
}

.guestbook-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.guestbook-actions :deep(.search-box) {
  min-width: 0;
  flex: 1;
}

.guestbook-clear {
  font-size: 0.8125rem;
  color: var(--accent-text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
}

@media (max-width: 640px) {
  :global(.guestbook-page) .main-content__header {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .guestbook-actions {
    width: 100%;
  }
}
</style>
