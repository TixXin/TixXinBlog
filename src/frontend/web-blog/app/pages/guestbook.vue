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
      <CommonCustomScrollbar
        ref="scrollbarRef"
        class="guestbook-center__messages"
        viewport-class="guestbook-viewport"
        :show-back-to-top="false"
        primary
      >
        <!-- 向上滚动加载历史消息 -->
        <Transition name="loader-fade">
          <div v-if="hasOlderMessages && showLoadingOlder" class="guestbook-loader">
            <Icon name="lucide:loader-2" size="18" class="guestbook-loader__spinner" />
            <span class="guestbook-loader__text">加载历史消息...</span>
          </div>
        </Transition>
        <div ref="topSentinelRef" class="guestbook-sentinel" />

        <GuestbookMessageList :groups="visibleGroups" />
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

// ---- 数据源 ----
const allDateGroups: DateGroup[] = JSON.parse(JSON.stringify(mockDateGroups))
const chatStats = mockChatStats
const chatRules = mockChatRules
const activeMembers = mockActiveMembers

// ---- 懒加载：从最新消息开始，向上滚动加载更早的日期组 ----
const INITIAL_GROUPS = 3
const LOAD_MORE_GROUPS = 3

const loadedGroupCount = ref(Math.min(INITIAL_GROUPS, allDateGroups.length))
const loadingOlder = ref(false)
const showLoadingOlder = ref(false)
const topSentinelRef = ref<HTMLElement | null>(null)
const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)

// 可见的日期组（从最新开始，逐步加载更早的）
const visibleGroups = computed(() => {
  // allDateGroups[0] 是最新的，取最后 loadedGroupCount 个作为可见
  return allDateGroups.slice(0, loadedGroupCount.value)
})

const hasOlderMessages = computed(() => loadedGroupCount.value < allDateGroups.length)

const totalMessageCount = computed(() =>
  allDateGroups.reduce((sum, g) => sum + g.messages.length, 0),
)

// ---- 加载更早的消息 ----
function loadOlderMessages() {
  if (loadingOlder.value || !hasOlderMessages.value) return
  loadingOlder.value = true
  showLoadingOlder.value = true

  const viewport = scrollbarRef.value?.viewport
  const prevScrollHeight = viewport?.scrollHeight ?? 0

  requestAnimationFrame(() => {
    loadedGroupCount.value = Math.min(
      loadedGroupCount.value + LOAD_MORE_GROUPS,
      allDateGroups.length,
    )

    // 保持滚动位置：加载旧消息后，内容向上增长，维持用户当前视图
    nextTick(() => {
      if (viewport) {
        const newScrollHeight = viewport.scrollHeight
        viewport.scrollTop += newScrollHeight - prevScrollHeight
      }
      loadingOlder.value = false
      showLoadingOlder.value = false
    })
  })
}

// ---- IntersectionObserver 监听顶部哨兵 ----
let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  const viewport = scrollbarRef.value?.viewport
  if (!viewport || !topSentinelRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasOlderMessages.value) {
        loadOlderMessages()
      }
    },
    { root: viewport, rootMargin: '200px 0px 0px 0px' },
  )
  observer.observe(topSentinelRef.value)
}

// ---- 发送消息 ----
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

  const todayGroup = allDateGroups.find((g) => g.date === today)
  if (todayGroup) {
    todayGroup.messages.unshift(newMsg)
  } else {
    allDateGroups.unshift({ date: today, messages: [newMsg] })
    // 新增日期组也要显示
    loadedGroupCount.value = Math.min(loadedGroupCount.value + 1, allDateGroups.length)
  }

  // 发送后滚动到底部
  nextTick(() => scrollToBottom())
}

// ---- 滚动到底部 ----
function scrollToBottom(smooth = true) {
  const viewport = scrollbarRef.value?.viewport
  if (!viewport) return
  viewport.scrollTo({
    top: viewport.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  })
}

// ---- 生命周期 ----
onMounted(() => {
  // 默认显示最底部（最新消息）
  nextTick(() => {
    scrollToBottom(false)
    // 等滚动完成后再设置 observer，避免初始触发加载
    setTimeout(() => setupObserver(), 100)
  })
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
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

.guestbook-sentinel {
  height: 1px;
}

.guestbook-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 0;
}

.guestbook-loader__spinner {
  color: var(--text-soft);
  animation: spin 1.2s linear infinite;
}

.guestbook-loader__text {
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.loader-fade-enter-active,
.loader-fade-leave-active {
  transition: opacity 0.25s ease;
}

.loader-fade-enter-from,
.loader-fade-leave-to {
  opacity: 0;
}
</style>
