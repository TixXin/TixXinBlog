<!--
  @file flash.vue
  @description 闪念主页：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="main-inner flash-page">
    <div class="main-content__header">
      <div class="flash-page__title">
        <Icon name="lucide:zap" size="20" />
        <h1>闪念</h1>
        <span class="flash-page__sub">{{
          isLoggedIn ? '记录稍纵即逝的灵感' : '博主的灵感碎片'
        }}</span>
        <button
          type="button"
          class="flash-page__search-toggle"
          :class="{ 'is-active': searchExpanded }"
          aria-label="搜索闪念"
          @click="searchExpanded = !searchExpanded"
        >
          <Icon name="lucide:search" size="14" />
        </button>
      </div>
      <!-- 搜索栏：展开后显示 -->
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
        <FlashEditor v-if="isLoggedIn" @submit="onSubmit" />
        <button v-else type="button" class="flash-page__guest-banner" @click="onLogin">
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
          @add-comment="onAddComment"
          @remove-comment="onRemoveComment"
          @tag-click="onTagFilter"
        />
      </div>
    </CommonCustomScrollbar>

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
    />
  </div>
</template>

<script setup lang="ts">
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

/** 筛选后的闪念列表：标签 AND 搜索关键词 */
const filteredNotes = computed(() => {
  let result = notes.value
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

async function onSubmit(draft: { content: string; tags: string[] }) {
  await add(draft)
  success('闪念已发布')
}

async function onRemove(id: string) {
  await remove(id)
  success('已删除')
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

.flash-page__title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--accent);

  h1 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-main);
  }
}

.flash-page__sub {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 500;
}

.flash-page__search-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  margin-left: auto;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s;

  &:hover,
  &.is-active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

/* ---- 搜索栏 ---- */
.flash-page__search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.625rem;
  padding: 0.5rem 0.75rem;
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
