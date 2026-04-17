<!--
  @file index.vue
  @description 闪念主页（原 flash.vue，为支持 /flash/:id 子路由迁移为目录式）：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="main-inner flash-page">
    <div class="main-content__header">
      <div class="page-title">
        <div class="page-title__icon-wrap" aria-hidden="true">
          <Icon name="lucide:zap" size="18" />
        </div>
        <div class="page-title__text">
          <h2 class="page-title__heading">闪念</h2>
          <p class="page-title__sub">
            {{ isLoggedIn ? '记录稍纵即逝的灵感' : '博主的灵感碎片' }}
          </p>
        </div>
      </div>

      <!-- 右侧操作区：归档箱 toggle + 搜索切换按钮 -->
      <div class="page-actions">
        <button
          v-if="isLoggedIn"
          type="button"
          class="flash-page__search-toggle"
          :class="{ 'is-active': showArchive }"
          :aria-label="showArchive ? '返回主列表' : '查看归档箱'"
          @click="toggleArchiveView"
        >
          <Icon :name="showArchive ? 'lucide:archive-restore' : 'lucide:archive'" size="14" />
          <span>{{ showArchive ? '返回主列表' : '归档箱' }}</span>
        </button>
        <button
          type="button"
          class="flash-page__search-toggle"
          :class="{ 'is-active': searchExpanded }"
          aria-label="搜索闪念"
          @click="searchExpanded = !searchExpanded"
        >
          <Icon name="lucide:search" size="14" />
          <span>搜索</span>
        </button>
      </div>

      <!-- 搜索栏：展开后显示，占满 header 整行 -->
      <div v-if="searchExpanded" class="flash-page__search-bar">
        <Icon name="lucide:search" size="13" class="flash-page__search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="flash-page__search-input"
          placeholder="搜索闪念内容或标签..."
          @keydown.escape="searchExpanded = false; searchQuery = ''"
        >
        <span v-if="debouncedQuery" class="flash-page__search-count">
          {{ filteredNotes.length }} 条结果
        </span>
      </div>
    </div>

    <CommonCustomScrollbar class="flash-page__body" viewport-class="flash-page__viewport" primary>
      <div class="flash-page__content">
        <!-- 类型 tab：全部 / 灵感 / 待办 / 随记 -->
        <nav class="flash-page__type-tabs" role="tablist" aria-label="按类型筛选">
          <button
            type="button"
            class="flash-page__type-tab"
            :class="{ 'is-active': typeFilter === null }"
            role="tab"
            :aria-selected="typeFilter === null"
            @click="typeFilter = null"
          >
            全部
          </button>
          <button
            v-for="t in typeTabs"
            :key="t.id"
            type="button"
            class="flash-page__type-tab"
            :class="{ 'is-active': typeFilter === t.id }"
            :data-type="t.id"
            role="tab"
            :aria-selected="typeFilter === t.id"
            @click="typeFilter = t.id"
          >
            <Icon :name="t.icon" size="12" />
            {{ t.label }}
          </button>
        </nav>

        <button v-if="!isLoggedIn" type="button" class="flash-page__guest-banner" @click="onLogin">
          <Icon name="lucide:eye" size="14" class="flash-page__guest-banner-icon" />
          <span class="flash-page__guest-banner-text">
            正在浏览博主的闪念，登录后开启你自己的灵感空间
          </span>
          <span class="flash-page__guest-banner-cta">
            立即登录
            <Icon name="lucide:arrow-right" size="12" />
          </span>
        </button>
        <!-- 标签筛选条 -->
        <div v-if="activeTag" class="flash-page__filter-bar">
          <span class="flash-page__filter-label">
            正在筛选 <strong>#{{ activeTag }}</strong> · {{ filteredNotes.length }} 条结果
          </span>
          <button type="button" class="flash-page__filter-clear" @click="activeTag = null">
            <Icon name="lucide:x" size="12" />
            清除
          </button>
        </div>
        <FlashNoteList
          :notes="filteredNotes"
          :loading="loading"
          :read-only="isReadOnly"
          :current-user-id="currentUserId"
          :guest-id="guestId"
          :highlighted-id="highlightedNoteId"
          @remove="onRemove"
          @toggle-like="onToggleLike"
          @set-pinned="onSetPinned"
          @set-archived="onSetArchived"
          @add-comment="onAddComment"
          @remove-comment="onRemoveComment"
          @tag-click="onTagFilter"
        />
      </div>
    </CommonCustomScrollbar>

    <!-- 底部发布输入框：仅登录者可见，参考留言板底部 MessageInput 的呈现方式 -->
    <div v-if="isLoggedIn" class="flash-page__composer-wrap">
      <div class="flash-page__composer">
        <FlashEditor @submit="onSubmit" />
      </div>
    </div>

    <!-- 右侧栏 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <div class="sidebar-list-group">
            <!-- AI 搜索入口 -->
            <button type="button" class="flash-ai-card" @click="onAiClick">
              <Icon name="lucide:sparkles" size="18" class="flash-ai-card__icon" />
              <div class="flash-ai-card__body">
                <span class="flash-ai-card__title">AI 搜索闪念</span>
                <span class="flash-ai-card__desc">{{
                  isLoggedIn ? '让 AI 帮你回顾过去的想法' : '登录后启用 AI 搜索'
                }}</span>
              </div>
              <Icon name="lucide:chevron-right" size="14" class="flash-ai-card__arrow" />
            </button>

            <!-- 统计卡片 -->
            <div class="flash-stat-card">
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">{{
                  isLoggedIn ? '闪念总数' : '博主总数'
                }}</span>
                <span class="flash-stat-card__value">{{ notes.length }}</span>
              </div>
              <div class="flash-stat-card__divider" />
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">本月新增</span>
                <span class="flash-stat-card__value">{{ monthlyCount }}</span>
              </div>
            </div>

            <!-- 标签云 -->
            <div v-if="tagCloud.length > 0" class="flash-tag-cloud">
              <div class="flash-tag-cloud__header">
                <Icon name="lucide:tags" size="14" />
                <span>标签云</span>
              </div>
              <div class="flash-tag-cloud__list">
                <span
                  v-for="t in tagCloud"
                  :key="t.name"
                  class="flash-tag-cloud__item"
                  :class="{ 'flash-tag-cloud__item--active': activeTag === t.name }"
                  :style="{ fontSize: tagFontSize(t.count) }"
                  @click="onTagFilter(t.name)"
                >
                  #{{ t.name }}
                  <span class="flash-tag-cloud__count">{{ t.count }}</span>
                </span>
              </div>
            </div>
          </div>
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>

    <FlashAISearchModal v-model:visible="aiModalVisible" :notes="notes" @cite-click="onCiteClick" />
    <CommonGuestIdentityModal
      :visible="identityModalVisible"
      @confirm="onIdentityConfirm"
      @cancel="identityModalVisible = false"
      @login="identityModalVisible = false; openLoginDrawer('login')"
    />
  </div>
</template>

<script setup lang="ts">
import type { FlashNote, FlashType } from '~/features/flash/types'

useSeoMeta({
  title: '闪念',
  description: '记录每一个稍纵即逝的灵感，配合 AI 搜索回顾你的想法历史',
})

const { isLoggedIn, currentUser } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const { success } = useToast()
const { guestIdentity, hasIdentity, resolveAvatar } = useGuestIdentity()
const {
  notes,
  loading,
  isReadOnly,
  tagCloud,
  monthlyCount,
  load,
  add,
  remove,
  toggleLike,
  setPinned,
  setArchived,
  loadArchived,
  addComment,
  removeComment,
} = useFlashNotes()

const currentUserId = computed(() => currentUser.value?.id ?? null)
const guestId = computed(() => guestIdentity.value?.id ?? null)
const aiModalVisible = ref(false)
const identityModalVisible = ref(false)
let pendingComment: { noteId: string; content: string } | null = null

// ---- 标签筛选 ----
const activeTag = ref<string | null>(null)

function onTagFilter(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

// ---- 类型筛选 ----
const typeFilter = ref<FlashType | null>(null)
const typeTabs: { id: FlashType; icon: string; label: string }[] = [
  { id: 'idea', icon: 'lucide:lightbulb', label: '灵感' },
  { id: 'todo', icon: 'lucide:check-square', label: '待办' },
  { id: 'memo', icon: 'lucide:file-text', label: '随记' },
]

// ---- 搜索 ----
const searchExpanded = ref(false)
const searchQuery = ref('')
const debouncedQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedQuery.value = v.trim().toLowerCase()
  }, 300)
})

/** 筛选后的闪念列表：归档箱 | 主列表，叠加 type AND 标签 AND 搜索关键词 */
const filteredNotes = computed(() => {
  let result = showArchive.value ? archivedNotes.value : notes.value
  if (typeFilter.value) {
    result = result.filter((n) => n.type === typeFilter.value)
  }
  if (activeTag.value) {
    result = result.filter((n) => n.tags.includes(activeTag.value!))
  }
  if (debouncedQuery.value) {
    const q = debouncedQuery.value
    result = result.filter(
      (n) => n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  return result
})

// ---- AI 引用高亮 ----
const highlightedNoteId = ref<string | null>(null)

function onCiteClick(noteId: string) {
  aiModalVisible.value = false
  highlightedNoteId.value = noteId
  nextTick(() => {
    document.getElementById(`flash-note-${noteId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      highlightedNoteId.value = null
    }, 2000)
  })
}

// ---- 页面事件 ----
function onLogin() {
  openLoginDrawer('login')
}

function onAiClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  aiModalVisible.value = true
}

onMounted(() => {
  void load()
})

// 登录态变化时重新加载（登入 / 切换用户）
watch(isLoggedIn, () => {
  void load(true)
})

async function onSubmit(draft: import('~/features/flash/types').FlashNoteDraft) {
  await add(draft)
  success('闪念已发布')
}

async function onRemove(id: string) {
  await remove(id)
  success('已删除')
}

async function onSetPinned(payload: { id: string; pinned: boolean }) {
  const updated = await setPinned(payload.id, payload.pinned)
  if (updated) success(payload.pinned ? '已置顶' : '已取消置顶')
}

async function onSetArchived(payload: { id: string; archived: boolean }) {
  const updated = await setArchived(payload.id, payload.archived)
  if (updated) {
    if (payload.archived) {
      success('已归档')
      // 若当前正在看归档箱，重新拉取让刚归档的笔记出现
      if (showArchive.value) {
        archivedNotes.value = await loadArchived()
      }
    } else {
      success('已恢复到主列表')
      // 归档箱视图里从本地列表移除；主列表需重载拿回笔记
      archivedNotes.value = archivedNotes.value.filter((n) => n.id !== payload.id)
      await load(true)
    }
  }
}

// ---- 归档箱 ----
const showArchive = ref(false)
const archivedNotes = ref<FlashNote[]>([])

async function toggleArchiveView() {
  showArchive.value = !showArchive.value
  if (showArchive.value) {
    archivedNotes.value = await loadArchived()
  }
}

async function onToggleLike(id: string) {
  const prevLikes = notes.value.find((n) => n.id === id)?.likes ?? 0
  await toggleLike(id)
  success(prevLikes > 0 ? '已取消点赞' : '已点赞')
}

async function onAddComment(payload: { noteId: string; content: string }) {
  if (isLoggedIn.value) {
    // 已登录 → 直接用 currentUser 信息
    await addComment(payload.noteId, payload.content)
    success('评论已发送')
    return
  }
  // 未登录 → 检查游客身份
  if (!hasIdentity.value) {
    // 无身份 → 暂存评论内容，弹出身份录入面板
    pendingComment = payload
    identityModalVisible.value = true
    return
  }
  // 有身份 → 用游客身份提交
  const avatar = resolveAvatar()
  await addComment(payload.noteId, payload.content, {
    id: guestIdentity.value!.id,
    name: guestIdentity.value!.nickname,
    avatar,
  })
  success('评论已发送')
}

function onIdentityConfirm() {
  identityModalVisible.value = false
  // 身份已保存到 localStorage，重新提交暂存的评论
  if (pendingComment) {
    void onAddComment(pendingComment)
    pendingComment = null
  }
}

async function onRemoveComment(payload: { noteId: string; commentId: string }) {
  await removeComment(payload.noteId, payload.commentId)
  success('评论已删除')
}

/** 标签云字号：count 越大字号越大，0.7 ~ 1.2rem */
function tagFontSize(count: number): string {
  const max = Math.max(...tagCloud.value.map((t) => t.count), 1)
  const ratio = 0.7 + (count / max) * 0.5
  return `${ratio}rem`
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style lang="scss" scoped>
.flash-page {
  display: flex;
  flex-direction: column;
}

/* ---- 右上角搜索切换按钮 ---- */
.flash-page__search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

/* ---- 搜索栏：展开后作为 header flex-wrap 的新行，占满整行 ---- */
.flash-page__search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  animation: flash-search-in 0.18s ease;

  &:focus-within {
    border-color: var(--accent);
  }
}

.flash-page__search-icon {
  flex-shrink: 0;
  color: var(--text-faint);
}

.flash-page__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8125rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.flash-page__search-count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

@keyframes flash-search-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.flash-page__body {
  flex: 1;
  min-height: 0;
}

:deep(.flash-page__viewport) {
  padding: 1.25rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 1.75rem;
  }
}

.flash-page__content {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

/* ---- 底部发布输入框容器 ---- */
.flash-page__composer-wrap {
  flex-shrink: 0;
  padding: 0.75rem 1rem 1rem;
  background: linear-gradient(to bottom, transparent, var(--surface-0) 30%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  @media (min-width: $breakpoint-md) {
    padding: 1rem 1.75rem 1.25rem;
  }
}

.flash-page__composer {
  max-width: 720px;
  margin: 0 auto;
}

/* ---- 类型 tab：全部 / 灵感 / 待办 / 随记 ---- */
.flash-page__type-tabs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.flash-page__type-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: $radius-full;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;

  &:hover {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &.is-active {
    color: #fff;
    background: var(--accent);
  }

  // type 专属配色
  &[data-type='idea'].is-active {
    background: #f59e0b;
  }

  &[data-type='todo'].is-active {
    background: #3b82f6;
  }
}

/* ---- 标签筛选条 ---- */
.flash-page__filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--accent-soft);
  border: 1px dashed var(--accent);
  border-radius: $radius-card;
  font-size: 0.75rem;
  color: var(--text-soft);
  animation: flash-search-in 0.18s ease;
}

.flash-page__filter-label {
  flex: 1;

  strong {
    color: var(--accent);
  }
}

.flash-page__filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;

  &:hover {
    opacity: 0.85;
  }
}

/* ---- 未登录浏览者的提示 banner ---- */
.flash-page__guest-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-card;
  background: var(--accent-soft);
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;

  &:hover {
    border-style: solid;
    transform: translateY(-1px);
  }
}

.flash-page__guest-banner-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.flash-page__guest-banner-text {
  flex: 1;
  color: var(--text-soft);
}

.flash-page__guest-banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--accent);
}

/* ---- 右栏卡片：AI 搜索入口 ---- */
.flash-ai-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  background: linear-gradient(135deg, var(--accent-soft), var(--surface-1));
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
}

.flash-ai-card__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.flash-ai-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.flash-ai-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
}

.flash-ai-card__desc {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.flash-ai-card__arrow {
  flex-shrink: 0;
  color: var(--text-faint);
}

/* ---- 右栏卡片：统计 ---- */
.flash-stat-card {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-stat-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.flash-stat-card__label {
  color: var(--text-soft);
}

.flash-stat-card__value {
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  font-size: 1.0625rem;
}

.flash-stat-card__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.625rem 0;
}

/* ---- 右栏卡片：标签云 ---- */
.flash-tag-cloud {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-tag-cloud__header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.flash-tag-cloud__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.625rem;
  align-items: baseline;
}

.flash-tag-cloud__item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  border-radius: $radius-full;
  transition:
    opacity 0.2s,
    background 0.2s,
    color 0.2s;

  &:hover {
    opacity: 0.7;
  }

  &--active {
    background: var(--accent);
    color: #fff;
    opacity: 1;

    .flash-tag-cloud__count {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.flash-tag-cloud__count {
  font-size: 0.625rem;
  color: var(--text-faint);
}

.sidebar-list-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
