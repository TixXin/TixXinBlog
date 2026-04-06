<!--
  @file guestbook.vue
  @description 留言板页面，聊天式留言列表与侧栏统计、守则与活跃成员
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="main-inner">
    <div class="guestbook-center">
      <GuestbookHeader :member-count="totalMessageCount" />
      <CommonCustomScrollbar class="guestbook-center__messages" viewport-class="guestbook-viewport">
        <GuestbookMessageList :groups="dateGroups" />
      </CommonCustomScrollbar>
      <GuestbookMessageInput @send="addMessage" />
    </div>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <GuestbookChatStats :stats="chatStats" />
          <GuestbookChatRules :rules="chatRules" />
          <GuestbookActiveMembers :members="activeMembers" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { DateGroup, GuestMessage } from '~/features/guestbook/types'
import { mockActiveMembers, mockChatRules, mockChatStats, mockDateGroups } from '~/features/guestbook/mock'

useSeoMeta({
  title: '留言板',
  description: '在这里留下你的足迹，和博主聊聊天',
  ogTitle: '留言板 - TixXin Blog',
  ogDescription: '在这里留下你的足迹，和博主聊聊天',
  ogType: 'website',
  ogImage: '/og-guestbook.jpg',
})

const dateGroups = ref<DateGroup[]>(JSON.parse(JSON.stringify(mockDateGroups)))

function addMessage(content: string) {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const newMsg: GuestMessage = {
    id: Date.now(),
    author: '访客',
    avatar: '',
    content,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    isOwner: false,
  }

  const todayGroup = dateGroups.value.find((g) => g.date === today)
  if (todayGroup) {
    todayGroup.messages.unshift(newMsg)
  } else {
    dateGroups.value.unshift({ date: today, messages: [newMsg] })
  }
}
const chatStats = mockChatStats
const chatRules = mockChatRules
const activeMembers = mockActiveMembers

const totalMessageCount = computed(() => dateGroups.value.reduce((sum, g) => sum + g.messages.length, 0))
</script>

<style lang="scss" scoped>
.guestbook-center {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.guestbook-center__messages {
  flex: 1;
  min-height: 0;
}
</style>
