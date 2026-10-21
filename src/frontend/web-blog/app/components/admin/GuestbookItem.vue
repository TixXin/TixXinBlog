<!--
  @file GuestbookItem.vue
  @description 留言审核卡片组件：展示留言作者、时间、客户端信息、正文、引用及操作按钮
  @author TixXin
  @since 2026-10-21
-->
<template>
  <AdminModerationItem
    :data-admin-guestbook-id="note.id"
    :selected="selected"
    selectable
    :select-disabled="disabled"
    :select-aria-label="
      $t('admin-media.guestbook.selectLabel', { author: note.author, content: note.content.slice(0, 40) })
    "
    select-class="admin-guestbook__select"
    actions-class="admin-guestbook__actions"
    @toggle-select="$emit('toggle-select', $event)"
  >
    <template #meta>
      <p>
        <strong>{{ note.author }}</strong
        >{{ note.isOwner ? $t('admin-media.guestbook.ownerSuffix') : '' }} ·
        {{ $t(`admin-media.guestbook.status.${note.moderationStatus}`)
        }}{{ note.isPinned ? $t('admin-media.guestbook.pinnedSuffix') : '' }} ·
        {{ $t('admin-media.guestbook.utcTime', { time: note.createdAt.slice(0, 16).replace('T', ' ') }) }}
        <span v-if="note.browser || note.region" class="admin-guestbook__client"
          >· {{ [note.browser, note.region].filter(Boolean).join(' · ') }}</span
        >
      </p>
    </template>
    <template #content>
      <p class="admin-guestbook__content">{{ note.content }}</p>
    </template>
    <template #extra>
      <p v-if="note.replyTo">
        {{ $t('admin-media.guestbook.quote', { author: note.replyTo.author, content: note.replyTo.content }) }}
      </p>
    </template>
    <template #actions>
      <button type="button" @click="$emit('view', note.id)">{{ $t('admin-media.guestbook.view') }}</button>
      <button type="button" :disabled="note.moderationStatus !== 'published'" @click="$emit('reply', note)">
        {{ $t('admin-media.guestbook.reply') }}
      </button>
      <button
        v-if="note.moderationStatus !== 'published'"
        type="button"
        :disabled="disabled"
        @click="$emit('change', note, { status: 'published' })"
      >
        {{ $t('admin-media.guestbook.publish') }}
      </button>
      <button
        v-if="note.moderationStatus !== 'hidden'"
        type="button"
        :disabled="disabled"
        @click="$emit('change', note, { status: 'hidden' })"
      >
        {{ $t('admin-media.guestbook.hide') }}
      </button>
      <button
        type="button"
        :disabled="disabled || note.moderationStatus !== 'published'"
        @click="$emit('change', note, { isPinned: !note.isPinned })"
      >
        {{ note.isPinned ? $t('admin-media.guestbook.unpin') : $t('admin-media.guestbook.pin') }}
      </button>
      <button type="button" :disabled="disabled" @click="$emit('remove', note)">
        {{ $t('admin-media.guestbook.remove') }}
      </button>
    </template>
  </AdminModerationItem>
</template>

<script setup lang="ts">
import type { ManagedGuestbookRecord } from '~/features/guestbook/types'

defineProps<{
  note: ManagedGuestbookRecord
  selected?: boolean
  disabled?: boolean
}>()

defineEmits<{
  'toggle-select': [checked: boolean]
  view: [id: number]
  reply: [note: ManagedGuestbookRecord]
  change: [
    note: ManagedGuestbookRecord,
    patch: { status?: 'published' | 'pending' | 'hidden'; isPinned?: boolean },
    remove?: boolean,
  ]
  remove: [note: ManagedGuestbookRecord]
}>()
</script>

<style scoped>
li {
  position: relative;
  padding: 1rem 1rem 1rem 3rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
li.is-selected {
  border-color: var(--accent);
}
:deep(.admin-guestbook__select) {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
:deep(.admin-guestbook__select input) {
  width: 1.1rem;
  height: 1.1rem;
  min-height: 0;
  padding: 0;
}
.admin-guestbook__content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
p {
  overflow-wrap: anywhere;
}
:deep(.admin-guestbook__actions) {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
:deep(.admin-guestbook__actions button) {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
:disabled {
  opacity: 0.5;
}
</style>
