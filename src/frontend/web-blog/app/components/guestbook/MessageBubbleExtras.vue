<!--
  @file MessageBubbleExtras.vue
  @description 留言气泡底部附加信息：已有反应表情列表与设备/地区信息展示
  @author TixXin
  @since 2026-10-21
-->

<template>
  <!-- 浏览器、地区与已有反应同排：设备信息靠头像一侧，反应靠气泡外缘，空间不足时才换行 -->
  <div
    v-if="reactions.length > 0 || message.browser || message.region"
    class="message-bubble__extras"
    :class="{
      'message-bubble__extras--end': message.isOwner,
      'message-bubble__extras--metadata-only': reactions.length === 0,
    }"
  >
    <div v-if="reactions.length > 0" class="message-bubble__reactions">
      <button
        v-for="r in reactions"
        :key="r.emoji"
        type="button"
        class="message-bubble__reaction"
        :class="{ 'message-bubble__reaction--active': r.reacted }"
        :aria-label="
          $t(
            'interaction.guestbookBubble.reactionCount',
            { label: $t(reactionMeta(r.emoji).labelKey), count: r.count },
            r.count,
          )
        "
        :aria-pressed="r.reacted"
        :disabled="!interactive || reacting || message.moderationStatus !== 'published'"
        @click="$emit('toggleReaction', r.emoji)"
      >
        <Icon :name="reactionMeta(r.emoji).icon" size="15" />
        <span class="message-bubble__reaction-count">{{ r.count }}</span>
      </button>
    </div>
    <p v-if="message.browser || message.region" class="message-bubble__foot message-bubble__foot--inline">
      <span v-if="message.browser" class="message-bubble__browser">
        <Icon name="lucide:monitor" size="11" class="message-bubble__browser-icon" />
        {{ message.browser }}
      </span>
      <span v-if="message.browser && message.region" class="message-bubble__dot" aria-hidden="true">·</span>
      <span v-if="message.region" class="message-bubble__region">
        <Icon name="lucide:map-pin" size="11" class="message-bubble__region-icon" />
        {{ message.region }}
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage, MessageReaction } from '~/features/guestbook/types'
import { reactionMeta } from '~/features/guestbook/reactions'

defineProps<{
  message: GuestMessage
  reactions: MessageReaction[]
  interactive?: boolean
  reacting?: boolean
}>()

defineEmits<{
  toggleReaction: [emoji: string]
}>()
</script>

<style lang="scss" scoped>
/* ---- 反应列表 ---- */
// 操作按钮常驻占位（3 个按钮 + 间距 + 与气泡的间隔），反应需让出这段宽度才能对齐气泡外缘
$actions-inset: 3 * 1.5rem + 2 * 0.125rem + 0.25rem;

.message-bubble__extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.625rem;
  padding-right: $actions-inset;

  @media (max-width: #{$breakpoint-sm - 1px}) {
    padding-right: 0;
  }

  .message-bubble__reactions {
    order: 1;
    margin-left: auto;
  }

  // 博主消息镜像：反应在左侧外缘，设备信息贴近头像
  &--end {
    padding-right: 0;
    padding-left: $actions-inset;

    @media (max-width: #{$breakpoint-sm - 1px}) {
      padding-left: 0;
    }

    .message-bubble__reactions {
      order: 0;
      margin-left: 0;
    }

    .message-bubble__foot {
      margin-left: auto;
    }
  }
}

.message-bubble__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.message-bubble__reaction {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: $radius-full;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  font-size: 0.6875rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉 21px 不变，伪元素把点击区扩到 25px
  &::after {
    content: '';
    position: absolute;
    inset: -3px -1px;
  }

  &:hover {
    border-color: var(--border);
    background: var(--surface-3, var(--surface-2));
  }

  &--active {
    border-color: color-mix(in srgb, var(--accent, #5b7cfa) 40%, transparent);
    background: color-mix(in srgb, var(--accent, #5b7cfa) 8%, var(--surface-2));
  }
}

.message-bubble__reaction-count {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

/* ---- 底部信息 ---- */
.message-bubble__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.375rem;
  font-size: 0.625rem;
  color: var(--text-faint);
  margin-top: 0.125rem;

  &--inline {
    margin-top: 0;
  }
}

.message-bubble__browser,
.message-bubble__region {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
}

.message-bubble__browser-icon,
.message-bubble__region-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.message-bubble__dot {
  opacity: 0.5;
}
</style>
