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

      <!-- 论坛模式：输入框在消息列表上方 -->
      <GuestbookMessageInput v-if="!isChatMode" @send="addMessage" />

      <!-- 消息区域 wrapper：浮动按钮的定位基准 -->
      <div class="guestbook-center__messages-wrap">
        <CommonCustomScrollbar
          ref="scrollbarRef"
          class="guestbook-center__messages"
          viewport-class="guestbook-viewport"
          :show-back-to-top="false"
          primary
          :primary-direction="isChatMode ? 'down' : 'up'"
        >
          <!-- 聊天模式：顶部哨兵，向上滚动加载历史消息 -->
          <template v-if="isChatMode">
            <Transition name="loader-fade">
              <div v-if="hasOlderMessages && showLoadingOlder" class="guestbook-loader">
                <Icon name="lucide:loader-2" size="18" class="guestbook-loader__spinner" />
                <span class="guestbook-loader__text">加载历史消息...</span>
              </div>
            </Transition>
            <div ref="topSentinelRef" class="guestbook-sentinel" />
          </template>

          <GuestbookMessageList :groups="visibleGroups" />

          <!-- 论坛模式：底部哨兵，向下滚动加载更早消息 -->
          <template v-if="!isChatMode">
            <div ref="bottomSentinelRef" class="guestbook-sentinel" />
            <Transition name="loader-fade">
              <div v-if="hasOlderMessages && showLoadingOlder" class="guestbook-loader">
                <Icon name="lucide:loader-2" size="18" class="guestbook-loader__spinner" />
                <span class="guestbook-loader__text">加载更多消息...</span>
              </div>
            </Transition>
          </template>
        </CommonCustomScrollbar>

        <!-- 聊天模式：返回底部浮动按钮 -->
        <Transition name="scroll-btn-fade">
          <button
            v-if="isChatMode && !isAtBottom"
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

      <!-- 聊天模式：输入框在消息列表下方 -->
      <GuestbookMessageInput v-if="isChatMode" @send="addMessage" />
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

// ---- 主题模式检测 ----
// 三栏主题（leftSidebar）为聊天模式：输入框在底部，最新消息在底部
// 双栏/单栏主题为论坛模式：输入框在顶部，最新消息在顶部
const { activeTheme } = useLayoutTheme()
const isChatMode = computed(() => activeTheme.value.capabilities.leftSidebar)

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
const bottomSentinelRef = ref<HTMLElement | null>(null)
const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)

// 可见的日期组（从最新的 N 组开始，逐步加载更早的）
const visibleGroups = computed(() => {
  const start = Math.max(0, allDateGroups.length - loadedGroupCount.value)
  const groups = allDateGroups.slice(start)

  if (isChatMode.value) {
    // 聊天模式：旧→新（上→下），数据原始顺序即可
    return groups
  }
  // 论坛模式：新→旧（上→下），反转日期组和组内消息
  return [...groups].reverse().map(g => ({
    ...g,
    messages: [...g.messages].reverse(),
  }))
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

    // 聊天模式：旧消息从顶部长出，需要保持当前视图位置
    nextTick(() => {
      if (isChatMode.value && viewport) {
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
  // 聊天模式用顶部哨兵（向上加载），论坛模式用底部哨兵（向下加载）
  const sentinel = isChatMode.value ? topSentinelRef.value : bottomSentinelRef.value
  if (!viewport || !sentinel) return

  const rootMargin = isChatMode.value
    ? '200px 0px 0px 0px'
    : '0px 0px 200px 0px'

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasOlderMessages.value) {
        loadOlderMessages()
      }
    },
    { root: viewport, rootMargin },
  )
  observer.observe(sentinel)
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
    todayGroup.messages.push(newMsg)
  } else {
    allDateGroups.push({ date: today, messages: [newMsg] })
    // 新增日期组也要显示
    loadedGroupCount.value = Math.min(loadedGroupCount.value + 1, allDateGroups.length)
  }

  // 发送后滚动到可见新消息的位置
  nextTick(() => {
    if (isChatMode.value) {
      scrollToBottom()
    } else {
      scrollbarRef.value?.scrollToTop(true)
    }
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

// ---- 生命周期 ----
onMounted(() => {
  nextTick(() => {
    // 聊天模式默认显示最底部（最新消息），论坛模式保持顶部
    if (isChatMode.value) {
      scrollToBottom(false)
    }
    // 等滚动完成后再设置 observer，避免初始触发加载
    setTimeout(() => setupObserver(), 100)
  })

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
