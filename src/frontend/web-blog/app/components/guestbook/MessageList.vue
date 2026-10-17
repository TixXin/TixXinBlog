<!--
  @file MessageList.vue
  @description 留言列表容器，按时间顺序连续展示；每条留言自带日期时间，不再插入日期分隔线
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="message-list">
    <TransitionGroup name="msg-enter" :css="false" @enter="onMsgEnter" @enter-cancelled="cancel">
      <GuestbookMessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :interactive="interactive"
        :reacting="reacting?.includes(msg.id)"
        :reaction-error="reactionErrors?.[msg.id]"
        :highlight="highlight"
        @react="$emit('react', $event)"
        @reply="(m) => $emit('reply', m)"
        @jump="$emit('jump', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { DateGroup, GuestMessage } from '~/features/guestbook/types'

const props = defineProps<{
  groups: DateGroup[]
  interactive?: boolean
  reacting?: number[]
  reactionErrors?: Record<number, string>
  /** 搜索关键词，命中处在正文与作者名里高亮 */
  highlight?: string
}>()

defineEmits<{
  reply: [message: GuestMessage]
  jump: [value: { target: number; from: number }]
  react: [value: { id: number; emoji: string; reacted: boolean; complete?: () => void }]
}>()

/** 分组已按时间排好序，平铺后连续渲染 */
const messages = computed<GuestMessage[]>(() => props.groups.flatMap((group) => group.messages))

const { enter, cancel } = useEntranceMotion()
/** 新消息入场由组件作用域持有，卸载与减少动态效果都可靠收尾。 */
function onMsgEnter(el: Element, done: () => void) {
  enter(el, done)
}
</script>

<style lang="scss" scoped>
.message-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem 1.5rem;
}
</style>
