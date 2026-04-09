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
      <!-- 消息区域 wrapper：浮动按钮的定位基准 -->
      <div class="guestbook-center__messages-wrap">
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

        <!-- 返回底部浮动按钮：锚定在消息区域右下角 -->
        <Transition name="scroll-btn-fade">
          <button
            v-if="!isAtBottom"
            type="button"
            class="guestbook-scroll-bottom"
            @click="scrollToBottom()"
          >
            <span v-if="newMessageCount > 0" class="guestbook-scroll-bottom__badge">
              {{ newMessageCount > 99 ? '99+' : newMessageCount }}
            </span>
            <Icon name="lucide:arrow-down" size="16" />
          </button>
        </Transition>
      </div>

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

  // 自己发送的消息始终滚动到底部；模拟他人消息时累加计数
  nextTick(() => {
    scrollToBottom()
    newMessageCount.value = 0
  })
}

// ---- 滚动位置检测 & 新消息计数 ----
const isAtBottom = ref(true)
const newMessageCount = ref(0)

function checkIsAtBottom() {
  const viewport = scrollbarRef.value?.viewport
  if (!viewport) return
  const { scrollTop, scrollHeight, clientHeight } = viewport
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 60
  // 回到底部时清零新消息计数
  if (isAtBottom.value) newMessageCount.value = 0
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

// ---- 全局滚动方向覆写：留言板为"返回底部" ----
const { scrollResetFn, scrollDirection } = useScrollProgress()

// ---- 生命周期 ----
onMounted(() => {
  // 默认显示最底部（最新消息）
  nextTick(() => {
    scrollToBottom(false)
    // 等滚动完成后再设置 observer，避免初始触发加载
    setTimeout(() => setupObserver(), 100)
  })

  // 覆写全局滚动行为：留言板回到底部而非顶部
  scrollResetFn.value = () => scrollToBottom(true)
  scrollDirection.value = 'down'

  // 监听滚动检测是否在底部
  watch(
    () => scrollbarRef.value?.viewport,
    (vp, oldVp) => {
      oldVp?.removeEventListener('scroll', checkIsAtBottom)
      vp?.addEventListener('scroll', checkIsAtBottom, { passive: true })
    },
    { immediate: true },
  )
})

onUnmounted(() => {
  scrollbarRef.value?.viewport?.removeEventListener('scroll', checkIsAtBottom)
  scrollDirection.value = 'up'
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

.guestbook-center__messages-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

/* ---- 返回底部浮动按钮 ---- */
.guestbook-scroll-bottom {
  position: absolute;
  right: 1.25rem;
  bottom: 1rem;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: $radius-full;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-1) 80%, transparent);
  backdrop-filter: blur(12px);
  color: var(--text-soft);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-main);
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.12));
  }
}

.guestbook-scroll-bottom__badge {
  position: absolute;
  top: -0.375rem;
  right: -0.375rem;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: $radius-full;
  background: var(--accent, #5b7cfa);
  color: #fff;
  font-size: 0.5625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(91, 124, 250, 0.4);
}

.scroll-btn-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.scroll-btn-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.scroll-btn-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.scroll-btn-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
