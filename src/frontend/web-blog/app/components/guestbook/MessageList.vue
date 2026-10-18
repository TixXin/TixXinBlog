<!--
  @file MessageList.vue
  @description 留言列表容器，相邻同作者五分钟内的消息共享组首身份与组尾设备地区
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="message-list">
    <TransitionGroup name="msg-enter" :css="false" @enter="onMsgEnter" @enter-cancelled="cancel">
      <GuestbookMessageBubble
        v-for="item in messages"
        :key="item.message.id"
        :message="item.message"
        :group-start="item.groupStart"
        :group-end="item.groupEnd"
        :class="{ 'message-list__continuation': !item.groupStart }"
        :interactive="interactive"
        :reacting="reacting?.includes(item.message.id)"
        :reaction-error="reactionErrors?.[item.message.id]"
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

/** 公开记录没有作者编号，按现有署名、头像和博主身份识别同一展示作者。 */
function canGroup(previous: GuestMessage | undefined, current: GuestMessage | undefined) {
  if (!previous?.createdAt || !current?.createdAt || !current.author) return false
  if (previous.author !== current.author || previous.avatar !== current.avatar || previous.isOwner !== current.isOwner)
    return false
  // 两种显示顺序共用相邻间隔；缺失或无效时间不会借用格式化文案合并。
  const interval = Math.abs(Date.parse(current.createdAt) - Date.parse(previous.createdAt))
  return Number.isFinite(interval) && interval <= 5 * 60 * 1000
}

/** 保留原顺序、逐条编号与节点，历史追加、筛选或删除后重新计算组边界。 */
const messages = computed(() => {
  const items = props.groups.flatMap((group) => group.messages)
  return items.map((message, index) => ({
    message,
    groupStart: !canGroup(items[index - 1], message),
    groupEnd: !canGroup(message, items[index + 1]),
  }))
})

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

  // 复用页面的聊天模式标记，论坛与窄屏继续逐条显示完整信息。
  [data-display-mode='chat'] & {
    gap: 0.25rem;

    > :not(:first-child):not(.message-list__continuation) {
      margin-top: 0.75rem;
    }
  }
}
</style>
