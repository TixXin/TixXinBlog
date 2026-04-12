<!--
  @file tabs.vue
  @description 标签页主页：通过 fullbleed 模式让 default layout 隐藏左右两栏，
               StatusFooter 不动；未登录回退展示博主的标签页（只读）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tabs-page">
    <!-- Teleport 到 body，避免 .main-content 祖先链上的 transform/filter 破坏 position:fixed -->
    <ClientOnly>
      <Teleport to="body">
        <TabSidebarFloating
          v-model:collapsed="sidebarCollapsed"
          :user="displayUser"
          :categories="categories"
          :active-id="activeCategoryId"
          :counts="categoryCounts"
          :total-count="bookmarks.length"
          :read-only="isReadOnly"
          @select="selectCategory"
          @add-category="addCategoryVisible = true"
          @remove-category="onRemoveCategory"
          @open-settings="settingsOpen = true"
          @open-donate="onDonate"
        />
      </Teleport>
    </ClientOnly>

    <div class="tabs-page__center">
      <div v-if="tabSettings.showGreeting || tabSettings.showDate" class="tabs-page__greeting">
        <h1 v-if="tabSettings.showGreeting" class="tabs-page__hello">{{ greetingLine }}</h1>
        <p v-if="tabSettings.showDate" class="tabs-page__date">{{ today }}</p>
      </div>

      <TabSearchBar />

      <div class="tabs-page__panel">
        <TabBookmarkGrid
          :bookmarks="visibleBookmarks"
          :read-only="isReadOnly"
          @add="onAddBookmarkClick"
          @remove="onRemoveBookmark"
        />
      </div>
    </div>

    <TabAddBookmarkDialog
      v-model:visible="addBookmarkVisible"
      :categories="categories"
      :default-category-id="activeCategoryId"
      @submit="onSubmitBookmark"
    />
    <TabAddCategoryDialog
      v-model:visible="addCategoryVisible"
      @submit="onSubmitCategory"
    />
    <TabSettingsDrawer
      v-model:visible="settingsOpen"
      :user="displayUser"
    />

    <!-- 游客提示：Teleport 到 body，避免祖先 transform 破坏 fixed 定位 -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="tabs-guest-toast">
          <div v-if="isReadOnly && !guestToastDismissed" class="tabs-guest-toast">
            <Icon name="lucide:info" size="14" class="tabs-guest-toast__icon" />
            <span class="tabs-guest-toast__text">正在浏览博主的标签页</span>
            <button type="button" class="tabs-guest-toast__login" @click="onLogin">
              登录
              <Icon name="lucide:log-in" size="11" />
            </button>
            <button type="button" class="tabs-guest-toast__close" aria-label="关闭" @click="guestToastDismissed = true">
              <Icon name="lucide:x" size="12" />
            </button>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { BookmarkDraft, BookmarkCategoryDraft } from '~/features/tab/types'
import { mockOwnerUser } from '~/features/auth/mock'

definePageMeta({ fullbleed: true })

useSeoMeta({
  title: '标签页',
  description: '你的个人起始页：搜索 + 书签 + 分类管理',
})

const { currentUser, isLoggedIn } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const {
  categories,
  bookmarks,
  visibleBookmarks,
  categoryCounts,
  activeCategoryId,
  isReadOnly,
  load,
  selectCategory,
  addBookmark,
  removeBookmark,
  addCategory,
  removeCategory,
} = useTabBookmarks()

const guestToastDismissed = ref(false)
const addBookmarkVisible = ref(false)
const addCategoryVisible = ref(false)
const settingsOpen = ref(false)
const { settings: tabSettings } = useTabSettings()
const sidebarCollapsed = ref(tabSettings.value.defaultCollapsed)

/** 侧栏与问候语用：未登录时显示博主信息 */
const displayUser = computed(() => currentUser.value ?? mockOwnerUser)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

const greetingLine = computed(() => {
  if (!isLoggedIn.value) return `欢迎来到 ${mockOwnerUser.nickname} 的标签页`
  return `${greeting.value}，${currentUser.value?.nickname ?? ''}`
})

const today = computed(() => {
  const d = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  let str = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`
  if (tabSettings.value.showSeconds) {
    str += ` · ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }
  return str
})

// 设置中的默认折叠变化时同步侧边栏
watch(() => tabSettings.value.defaultCollapsed, (v) => {
  sidebarCollapsed.value = v
})

onMounted(() => {
  void load()
})

watch(isLoggedIn, () => {
  void load(true)
})

function onLogin() {
  openLoginDrawer('login')
}

function onAddBookmarkClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  addBookmarkVisible.value = true
}

async function onSubmitBookmark(draft: BookmarkDraft) {
  await addBookmark(draft)
}

async function onRemoveBookmark(id: string) {
  await removeBookmark(id)
}

async function onSubmitCategory(draft: BookmarkCategoryDraft) {
  await addCategory(draft)
}

function onDonate() {
  // 打赏功能占位，后续实现
}

async function onRemoveCategory(id: string) {
  if (!window.confirm('确认删除该分类？该分类下的书签也会一并删除。')) return
  await removeCategory(id)
}
</script>

<style lang="scss" scoped>
.tabs-page {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 悬浮侧栏不占文档流，内容区自然居中，无需 padding-left */
}

.tabs-page__center {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 3.5rem 1.5rem 2.5rem;
  gap: 1.75rem;
  width: 100%;
  margin: 0 auto;
}

.tabs-page__greeting {
  text-align: center;
}

.tabs-page__hello {
  margin: 0 0 0.375rem;
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
}

.tabs-page__date {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
}

.tabs-page__panel {
  width: 100%;
  padding: 0.5rem 0;
}

/* ---- 右下角游客提示浮窗 ---- */
.tabs-guest-toast {
  position: fixed;
  bottom: 5rem;
  right: 1.5rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.75rem;
}

.tabs-guest-toast__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.tabs-guest-toast__text {
  color: var(--text-soft);
  white-space: nowrap;
}

.tabs-guest-toast__login {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: var(--accent);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.18s;

  &:hover {
    opacity: 0.85;
  }
}

.tabs-guest-toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.125rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

.tabs-guest-toast-enter-active,
.tabs-guest-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.tabs-guest-toast-enter-from,
.tabs-guest-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

</style>
