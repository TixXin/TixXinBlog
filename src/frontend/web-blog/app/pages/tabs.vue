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
          @add-category="onAddCategoryClick"
          @remove-category="onRemoveCategory"
        />
      </Teleport>
    </ClientOnly>

    <div class="tabs-page__center">
      <div class="tabs-page__greeting">
        <h1 class="tabs-page__hello">{{ greetingLine }}</h1>
        <p class="tabs-page__date">{{ today }}</p>
      </div>

      <TabSearchBar />

      <button v-if="isReadOnly" type="button" class="tabs-page__guest-banner" @click="onLogin">
        <Icon name="lucide:eye" size="14" class="tabs-page__guest-banner-icon" />
        <span class="tabs-page__guest-banner-text">
          正在浏览博主的标签页，登录后管理你自己的常用网址
        </span>
        <span class="tabs-page__guest-banner-cta">
          立即登录
          <Icon name="lucide:arrow-right" size="12" />
        </span>
      </button>

      <div class="tabs-page__panel">
        <div class="tabs-page__panel-header">
          <Icon
            :name="activeCategory?.icon || 'lucide:layout-grid'"
            size="14"
            :style="activeCategory ? { color: activeCategory.color } : undefined"
          />
          <span>{{ activeCategory?.name || '全部书签' }}</span>
          <span class="tabs-page__panel-count">{{ visibleBookmarks.length }}</span>
        </div>
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
  </div>
</template>

<script setup lang="ts">
import type { BookmarkDraft } from '~/features/tab/types'
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

const addBookmarkVisible = ref(false)
const sidebarCollapsed = ref(false)

/** 侧栏与问候语用：未登录时显示博主信息 */
const displayUser = computed(() => currentUser.value ?? mockOwnerUser)

const activeCategory = computed(() =>
  activeCategoryId.value ? categories.value.find((c) => c.id === activeCategoryId.value) : null,
)

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
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`
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

async function onAddCategoryClick() {
  const name = window.prompt('请输入分类名称')
  if (!name?.trim()) return
  await addCategory({ name: name.trim(), icon: 'lucide:folder', color: '#64748b' })
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
  max-width: 880px;
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

/* ---- 未登录浏览者的提示 banner（与闪念页同款） ---- */
.tabs-page__guest-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  max-width: 640px;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-card;
  background: var(--accent-soft);
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-style: solid;
    transform: translateY(-1px);
  }
}

.tabs-page__guest-banner-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.tabs-page__guest-banner-text {
  flex: 1;
  color: var(--text-soft);
}

.tabs-page__guest-banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--accent);
}

.tabs-page__panel {
  width: 100%;
  padding: 1.25rem 1.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(8px);
}

.tabs-page__panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-soft);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
}

.tabs-page__panel-count {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
