<!--
  @file MessageList.vue
  @description 按日期分组的留言列表容器，组间展示日期分隔徽标
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="message-list">
    <template
      v-for="group in groups"
      :key="group.date"
    >
      <div class="message-list__date-row">
        <span class="message-list__date-badge">{{ group.date }}</span>
      </div>
      <TransitionGroup name="msg-enter" :css="false" @enter="onMsgEnter">
        <GuestbookMessageBubble
          v-for="msg in group.messages"
          :key="msg.id"
          :message="msg"
        />
      </TransitionGroup>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DateGroup } from '~/features/guestbook/types'

defineProps<{
  groups: DateGroup[]
}>()

/** 新消息渐入 + 轻微上移动画 */
function onMsgEnter(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateY(8px)'

  requestAnimationFrame(() => {
    htmlEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'translateY(0)'

    const onEnd = () => {
      htmlEl.style.transition = ''
      htmlEl.style.transform = ''
      htmlEl.removeEventListener('transitionend', onEnd)
      done()
    }
    htmlEl.addEventListener('transitionend', onEnd, { once: true })
  })
}
</script>

<style lang="scss" scoped>
.message-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem 1.5rem;
}

.message-list__date-row {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}

.message-list__date-badge {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--text-soft);
  padding: 0.25rem 0.75rem;
  border-radius: $radius-full;
  user-select: none;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
}
</style>
