<!--
  @file MessageBubbleMeta.vue
  @description 留言气泡元信息展示：用户名、留言时间与博主身份徽章
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="message-bubble__meta" :class="{ 'message-bubble__meta--reverse': message.isOwner }">
    <template v-if="message.isOwner">
      <span class="message-bubble__time">{{ message.time }}</span>
      <span class="message-bubble__name"
        ><template v-for="(part, index) in authorParts" :key="index"
          ><mark v-if="part.match" class="message-bubble__mark">{{ part.text }}</mark
          ><template v-else>{{ part.text }}</template></template
        ></span
      >
      <span class="message-bubble__owner-badge">{{ $t('interaction.guestbook.owner') }}</span>
    </template>
    <template v-else>
      <span class="message-bubble__name"
        ><template v-for="(part, index) in authorParts" :key="index"
          ><mark v-if="part.match" class="message-bubble__mark">{{ part.text }}</mark
          ><template v-else>{{ part.text }}</template></template
        ></span
      >
      <span class="message-bubble__time">{{ message.time }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

defineProps<{
  message: GuestMessage
  authorParts: { text: string; match: boolean }[]
}>()
</script>

<style lang="scss" scoped>
.message-bubble__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  &--reverse {
    flex-direction: row-reverse;
  }
}

.message-bubble__name {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
}

.message-bubble__time {
  font-size: 0.625rem;
  color: var(--text-faint);
  flex-shrink: 0;
}

.message-bubble__owner-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);

  &--sm {
    font-size: 0.5rem;
    padding: 0.0625rem 0.25rem;
  }
}

:root.dark .message-bubble__owner-badge {
  background: linear-gradient(135deg, #5b7cfa, #7b95ff);
}

.message-bubble__mark {
  padding: 0 0.125rem;
  border-radius: 0.1875rem;
  color: #1e293b;
  background: #fde68a;
}
</style>
