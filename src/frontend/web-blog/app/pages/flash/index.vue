<!--
  @file index.vue
  @description 闪念主页（原 flash.vue，为支持 /flash/:id 子路由迁移为目录式）：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <CommonPageFrame class="main-inner flash-page" header-key="flash">
    <template #header>
      <div class="main-content__header">
        <div class="page-title">
          <div class="page-title__icon-wrap" aria-hidden="true">
            <Icon name="lucide:zap" size="18" />
          </div>
          <div class="page-title__text">
            <h1 class="page-title__heading">{{ $t('flash-moment.flash.title') }}</h1>
            <p class="page-title__sub">
              {{ isLoggedIn ? $t('flash-moment.flash.subOwner') : $t('flash-moment.flash.subGuest') }}
            </p>
          </div>
        </div>

        <!-- 右侧操作区：RSS 订阅、归档箱与搜索切换 -->
        <div class="page-actions">
          <BlogRssLink href="/flash.xml" :label="$t('article.rss.flash')" compact />
          <button
            v-if="isLoggedIn"
            type="button"
            class="flash-page__search-toggle"
            :class="{ 'is-active': showArchive }"
            :aria-label="showArchive ? $t('flash-moment.flash.backToMain') : $t('flash-moment.flash.openArchive')"
            @click="toggleArchiveView"
          >
            <Icon :name="showArchive ? 'lucide:archive-restore' : 'lucide:archive'" size="16" />
            <span>{{ showArchive ? $t('flash-moment.flash.backToMain') : $t('flash-moment.flash.archive') }}</span>
          </button>
          <button
            ref="searchButtonRef"
            type="button"
            class="flash-page__search-toggle"
            :class="{ 'is-active': searchExpanded }"
            :aria-label="$t('flash-moment.flash.searchToggle')"
            :aria-expanded="searchExpanded"
            aria-controls="flash-search"
            @click="searchExpanded = !searchExpanded"
          >
            <Icon name="lucide:search" size="16" />
            <span>{{ $t('flash-moment.flash.search') }}</span>
          </button>
        </div>

        <!-- 搜索栏：展开后显示，占满 header 整行 -->
        <div v-if="searchExpanded" class="flash-page__search-bar">
          <Icon name="lucide:search" size="13" class="flash-page__search-icon" />
          <input
            id="flash-search"
            ref="searchInputRef"
            v-model="searchQuery"
            :aria-label="$t('flash-moment.flash.searchInput')"
            type="text"
            class="flash-page__search-input"
            :placeholder="$t('flash-moment.flash.searchPlaceholder')"
            @keydown.escape="closeSearch"
          />
          <span v-if="debouncedQuery" class="flash-page__search-count">
            {{ $t('flash-moment.flash.resultCount', { count: resultCount }, resultCount) }}
          </span>
          <button
            type="button"
            class="flash-page__filter-clear"
            :aria-label="$t('flash-moment.flash.closeSearch')"
            @click="closeSearch"
          >
            <Icon name="lucide:x" size="16" />
          </button>
        </div>
      </div>
    </template>
    <template #default>
      <CommonCustomScrollbar class="flash-page__body" viewport-class="flash-page__viewport" primary>
        <div class="flash-page__content">
          <!-- 类型 tab：全部 / 灵感 / 待办 / 随记 -->
          <div class="flash-page__type-tabs" role="group" :aria-label="$t('flash-moment.flash.typeGroup')">
            <button
              type="button"
              class="flash-page__type-tab"
              :class="{ 'is-active': typeFilter === null }"
              :aria-pressed="typeFilter === null"
              @click="typeFilter = null"
            >
              {{ $t('flash-moment.flash.all') }}
            </button>
            <button
              v-for="tab in typeTabs"
              :key="tab.id"
              type="button"
              class="flash-page__type-tab"
              :class="{ 'is-active': typeFilter === tab.id }"
              :data-type="tab.id"
              :aria-pressed="typeFilter === tab.id"
              @click="typeFilter = tab.id"
            >
              <Icon :name="tab.icon" size="12" />
              {{ tab.label }}
            </button>
          </div>

          <button v-if="!isLoggedIn" type="button" class="flash-page__guest-banner" @click="onLogin">
            <Icon name="lucide:eye" size="14" class="flash-page__guest-banner-icon" />
            <span class="flash-page__guest-banner-text"> {{ $t('flash-moment.flash.guestBanner') }} </span>
            <span class="flash-page__guest-banner-cta">
              {{ $t('flash-moment.flash.loginNow') }}
              <Icon name="lucide:arrow-right" size="12" />
            </span>
          </button>
          <!-- 标签筛选条 -->
          <div v-if="activeTag || selectedDate || debouncedQuery || typeFilter" class="flash-page__filter-bar">
            <span class="flash-page__filter-label" role="status">
              {{ $t('flash-moment.flash.filterCurrent', { summary: filterSummary }) }}
              · {{ $t('flash-moment.flash.resultCount', { count: resultCount }, resultCount) }}
            </span>
            <button type="button" class="flash-page__filter-clear" @click="clearFilters">
              <Icon name="lucide:x" size="12" />
              {{ $t('flash-moment.flash.clearFilters') }}
            </button>
          </div>
          <CommonRequestFeedback
            v-if="overviewError || overviewRetrying"
            compact
            :pending="overviewLoading"
            :title="$t('flash-moment.flash.overviewFailed')"
            :description="$t('flash-moment.flash.overviewFailedDesc')"
            @retry="retryOverview"
          />
          <FlashNoteList
            :notes="filteredNotes"
            :pending-ids="pendingIds"
            :loading="listPending"
            :error-message="listError"
            :empty-message="emptyMessage"
            :read-only="isReadOnly"
            :current-user-id="currentUserId"
            :guest-id="guestId"
            :highlighted-id="highlightedNoteId"
            :has-more="listHasMore"
            :more-pending="listMorePending"
            :more-error="listMoreError"
            @retry="retryList"
            @more="onMore"
            @remove="onRemove"
            @edit="onEdit"
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
          <p v-if="editingNote">
            {{ $t('flash-moment.flash.editing') }}
            <button type="button" @click="cancelEdit">{{ $t('flash-moment.flash.cancelEdit') }}</button>
          </p>
          <FlashEditor
            :key="editorVersion"
            ref="editorRef"
            :initial="editingNote"
            :submitting="publishing || loading"
            @submit="onSubmit"
            @dirty="editorDirty = $event"
          />
        </div>
      </div>
      <!-- 右侧栏 -->
    </template>
    <template #overlays>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <div class="sidebar-list-group">
            <!-- AI 搜索入口 -->
            <button type="button" class="flash-ai-card" @click="onAiClick">
              <Icon name="lucide:sparkles" size="18" class="flash-ai-card__icon" />
              <div class="flash-ai-card__body">
                <span class="flash-ai-card__title">{{ $t('flash-moment.flash.aiTitle') }}</span>
                <span class="flash-ai-card__desc">{{
                  isLoggedIn ? $t('flash-moment.flash.aiDescOwner') : $t('flash-moment.flash.aiDescGuest')
                }}</span>
              </div>
              <Icon name="lucide:chevron-right" size="14" class="flash-ai-card__arrow" />
            </button>

            <!-- 统计卡片 -->
            <div class="flash-stat-card">
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">{{
                  isLoggedIn ? $t('flash-moment.flash.statTotal') : $t('flash-moment.flash.statOwnerTotal')
                }}</span>
                <span class="flash-stat-card__value">{{ totalCount ?? '—' }}</span>
              </div>
              <div class="flash-stat-card__divider" />
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">{{ $t('flash-moment.flash.statMonthly') }}</span>
                <span class="flash-stat-card__value">{{ aggregatesReady ? monthlyCount : '—' }}</span>
              </div>
            </div>

            <!-- 发布日历 -->
            <!-- 日历、时间胶囊与标签云来自概览；公开视图在挂载后读取概览接口，SSR 不输出，避免水合差异 -->
            <SidebarFlashCalendarCard
              v-if="aggregatesReady && overview"
              :dates="overview.dates"
              :selected-date="selectedDate"
              @select-date="onSelectDate"
            />

            <!-- 时间胶囊：去年今日 + 随机回顾 -->
            <SidebarFlashTimeCapsuleCard
              v-if="aggregatesReady && overview"
              :on-this-day="overview.onThisDay"
              :recollections="overview.recollections"
            />

            <!-- 标签云 -->
            <div v-if="tagCloud.length > 0" class="flash-tag-cloud">
              <div class="flash-tag-cloud__header">
                <Icon name="lucide:tags" size="14" />
                <span>{{ $t('flash-moment.flash.tagCloud') }}</span>
              </div>
              <div class="flash-tag-cloud__list">
                <button
                  v-for="item in tagCloud"
                  :key="item.name"
                  type="button"
                  :aria-pressed="activeTag === item.name"
                  class="flash-tag-cloud__item"
                  :class="{ 'flash-tag-cloud__item--active': activeTag === item.name }"
                  :style="{ fontSize: tagFontSize(item.count) }"
                  @click="onTagFilter(item.name)"
                >
                  #{{ item.name }}
                  <span class="flash-tag-cloud__count">{{ item.count }}</span>
                </button>
              </div>
            </div>
          </div>
        </SidebarRightSidebar>
      </Teleport>
      <FlashAISearchModal v-model:visible="aiModalVisible" :notes="notes" @cite-click="onCiteClick" />
      <CommonGuestIdentityModal
        :visible="identityModalVisible"
        @confirm="onIdentityConfirm"
        @cancel="cancelIdentity"
        @login="loginForComment"
      />
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'
import type { FlashNote, FlashType, FlashCommentSubmission } from '~/features/flash/types'
import { commentSubmittedMessage } from '~/features/flash/comments'

const { t } = useI18n()

usePageSeo({
  title: () => t('flash-moment.flash.seoTitle'),
  description: () => t('flash-moment.flash.seoDescription'),
  type: 'website',
})

const { isLoggedIn, currentUser } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const { success, error: showError } = useToast()
const { guestIdentity, hasIdentity, resolveAvatar } = useGuestIdentity()
const {
  error: storageError,
  notes,
  loading,
  loaded,
  ownerKey,
  isReadOnly,
  pagedPublic,
  total,
  hasMore,
  moreLoading,
  moreError,
  overview,
  overviewLoading,
  overviewError,
  aggregatesReady,
  totalCount,
  tagCloud,
  monthlyCount,
  load,
  loadMore,
  loadOverview,
  setPublicFilter,
  add,
  update,
  remove,
  toggleLike,
  setPinned,
  setArchived,
  loadArchived,
  addComment,
  removeComment,
} = useFlashNotes()

const overviewRetrying = ref(false)
async function retryOverview() {
  if (overviewLoading.value) return
  overviewRetrying.value = true
  try {
    await loadOverview(true)
  } finally {
    overviewRetrying.value = false
  }
}

const currentUserId = computed(() => currentUser.value?.id ?? null)
const guestId = computed(() => guestIdentity.value?.id ?? null)
const aiModalVisible = ref(false)
const identityModalVisible = ref(false)
let pendingComment: FlashCommentSubmission | null = null
const pendingIds = ref<string[]>([])

// ---- 标签筛选 ----
const activeTag = ref<string | null>(null)

function onTagFilter(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

// ---- 日期筛选 ----
const selectedDate = ref<string | null>(null)

function onSelectDate(date: string | null) {
  selectedDate.value = date
}

// ---- 类型筛选 ----
const typeFilter = ref<FlashType | null>(null)
const typeTabs = computed<{ id: FlashType; icon: string; label: string }[]>(() => [
  { id: 'idea', icon: 'lucide:lightbulb', label: t('flash-moment.flashType.idea') },
  { id: 'todo', icon: 'lucide:check-square', label: t('flash-moment.flashType.todo') },
  { id: 'memo', icon: 'lucide:file-text', label: t('flash-moment.flashType.memo') },
])
/** 筛选条摘要：类型 · 标签 · 日期 · 关键词 */
const filterSummary = computed(() =>
  [
    typeTabs.value.find((tab) => tab.id === typeFilter.value)?.label,
    activeTag.value ? '#' + activeTag.value : '',
    selectedDate.value,
    debouncedQuery.value ? t('flash-moment.flash.filterKeyword', { keyword: debouncedQuery.value }) : '',
  ]
    .filter(Boolean)
    .join(' · '),
)

// ---- 搜索 ----
const searchExpanded = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchButtonRef = ref<HTMLButtonElement | null>(null)
watch(searchExpanded, (expanded) => {
  if (expanded) nextTick(() => searchInputRef.value?.focus())
})
const searchQuery = ref('')
const debouncedQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedQuery.value = v.trim()
  }, 300)
})

/** 在已取得的集合上叠加 type/标签/日期/搜索关键词（私有视图与归档箱使用；日期按 UTC 日） */
function filterLocal(source: FlashNote[]) {
  let result = source
  if (typeFilter.value) {
    result = result.filter((n) => n.type === typeFilter.value)
  }
  if (activeTag.value) {
    result = result.filter((n) => n.tags.includes(activeTag.value!))
  }
  if (selectedDate.value) {
    result = result.filter((n) => n.createdAt.slice(0, 10) === selectedDate.value)
  }
  if (debouncedQuery.value) {
    const q = debouncedQuery.value.toLowerCase()
    result = result.filter(
      (n) => n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  return result
}

/** 公开视图的筛选全部交给后端分页：类型、标签、UTC 日期与关键词可任意组合 */
watch([pagedPublic, typeFilter, activeTag, selectedDate, debouncedQuery], () => {
  if (!pagedPublic.value) return
  setPublicFilter({ tag: activeTag.value, q: debouncedQuery.value, type: typeFilter.value, date: selectedDate.value })
})

const matchedNotes = computed(() => {
  if (showArchive.value) return filterLocal(archivedNotes.value)
  if (!pagedPublic.value) return filterLocal(notes.value)
  // 服务端已按全部条件筛选，直接展示已加载的页
  return notes.value
})
/** 筛选后的闪念列表：归档箱 | 主列表 */
const filteredNotes = matchedNotes
/** 结果条数：服务端分页用接口总数，其余为本地筛选结果 */
const resultCount = computed(() => (pagedPublic.value && !showArchive.value ? total.value : matchedNotes.value.length))
const listHasMore = computed(() => !showArchive.value && hasMore.value)
const listMorePending = computed(() => moreLoading.value)
const listMoreError = computed(() => moreError.value)
function onMore() {
  void loadMore()
}

// ---- AI 引用高亮 ----
const highlightedNoteId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined
let cancelCitationScroll: (() => void) | undefined
let citationAlive = true
onBeforeUnmount(() => {
  citationAlive = false
  if (highlightTimer) clearTimeout(highlightTimer)
  cancelCitationScroll?.()
})

function onCiteClick(noteId: string) {
  aiModalVisible.value = false
  clearFilters()
  if (highlightTimer) clearTimeout(highlightTimer)
  cancelCitationScroll?.()
  highlightedNoteId.value = noteId
  nextTick(() => {
    if (!citationAlive) return
    const node = document.getElementById(`flash-note-${noteId}`)
    if (!node) return
    const root = resolveScrollRoot(node.parentElement)
    const rect = node.getBoundingClientRect()
    const top =
      (root?.scrollTop ?? window.scrollY) +
      rect.top -
      (root?.getBoundingClientRect().top ?? 0) -
      (root?.clientHeight ?? window.innerHeight) / 2 +
      rect.height / 2
    cancelCitationScroll = scrollToRoot(root, top)
    node.setAttribute('tabindex', '-1')
    node.focus({ preventScroll: true })
    node.addEventListener('blur', () => node.removeAttribute('tabindex'), { once: true })
    highlightTimer = setTimeout(() => {
      highlightedNoteId.value = null
    }, 2000)
  })
}

// ---- 页面事件 ----
function onLogin() {
  openLoginDrawer('login', true)
}

function onAiClick() {
  if (!isLoggedIn.value) {
    openLoginDrawer('login')
    return
  }
  aiModalVisible.value = true
}

// 公开视图首屏在服务端直出第一页；上游失败交给 AsyncData，降级页以 503 返回且不进入页面缓存。
// 水合阶段沿用服务端输出的状态（包括失败态），重试交给挂载后的 load()，首帧与 SSR 保持一致。
await useAsyncData('flash-public-first-page', async (app) => {
  if (import.meta.client && app.isHydrating) return true
  if (pagedPublic.value) await load(false, { rethrow: import.meta.server })
  return true
})

// 公开概览是一次小体量聚合请求，挂载后直接读取（不进入 SSR，侧栏随后出现，首帧与服务端一致）
onMounted(() => {
  void load()
  void loadOverview()
})

// 登录身份、内容归属或内容库变化时，主列表与私有归档同时切换。
watch(ownerKey, () => {
  archiveVersion += 1
  showArchive.value = false
  archivedNotes.value = []
  archiveLoaded.value = false
  archiveLoading.value = false
  archiveError.value = null
  void load(true)
  void loadOverview()
})

const editingNote = ref<FlashNote | null>(null)
const editorDirty = ref(false)
const editorRef = ref<{ focus: () => void } | null>(null)
async function onEdit(note: FlashNote) {
  if (editorDirty.value && !window.confirm(t('flash-moment.flash.confirmDiscardForEdit'))) return
  editingNote.value = note
  editorDirty.value = false
  editorVersion.value += 1
  await nextTick()
  editorRef.value?.focus()
}
function cancelEdit() {
  if (editorDirty.value && !window.confirm(t('flash-moment.flash.confirmDiscardChanges'))) return
  editingNote.value = null
  editorDirty.value = false
  editorVersion.value += 1
}
const editorVersion = ref(0)
const publishing = ref(false)
async function onSubmit(draft: import('~/features/flash/types').FlashNoteDraft) {
  if (publishing.value) return
  publishing.value = true
  try {
    const created = editingNote.value ? await update(editingNote.value.id, draft) : await add(draft)
    if (created) {
      editingNote.value = null
      editorDirty.value = false
      editorVersion.value += 1
      success(draft.isDraft ? t('flash-moment.flash.toastDraftSaved') : t('flash-moment.flash.toastPublished'))
    }
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastSaveFailed'))
  } finally {
    publishing.value = false
  }
}

async function runNoteAction(id: string, action: () => Promise<void>) {
  if (pendingIds.value.includes(id)) return
  pendingIds.value.push(id)
  try {
    await action()
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastActionFailed'))
  } finally {
    pendingIds.value = pendingIds.value.filter((value) => value !== id)
  }
}
async function onRemove(id: string) {
  await runNoteAction(id, async () => {
    await remove(id)
    archivedNotes.value = archivedNotes.value.filter((note) => note.id !== id)
    success(t('flash-moment.flash.toastDeleted'))
  })
}
async function onSetPinned(payload: { id: string; pinned: boolean }) {
  await runNoteAction(payload.id, async () => {
    const changed = await setPinned(payload.id, payload.pinned)
    if (changed) {
      archivedNotes.value = archivedNotes.value.map((note) => (note.id === changed.id ? changed : note))
      success(payload.pinned ? t('flash-moment.flash.toastPinned') : t('flash-moment.flash.toastUnpinned'))
    }
  })
}
async function onSetArchived(payload: { id: string; archived: boolean }) {
  await runNoteAction(payload.id, async () => {
    const changed = await setArchived(payload.id, payload.archived)
    if (!changed) return
    await refreshArchived()
    if (!payload.archived) await load(true)
    success(payload.archived ? t('flash-moment.flash.toastArchived') : t('flash-moment.flash.toastRestored'))
  })
}

// ---- 归档箱 ----
const showArchive = ref(false)
const archivedNotes = ref<FlashNote[]>([])
const archiveLoading = ref(false)
const archiveLoaded = ref(false)
const archiveError = ref<string | null>(null)
let archiveVersion = 0
const listError = computed(() => (showArchive.value ? archiveError.value : storageError.value))
const listPending = computed(() => {
  if (showArchive.value) return archiveLoading.value || (!archiveLoaded.value && !archiveError.value)
  return loading.value || (!loaded.value && !storageError.value)
})
const emptyMessage = computed(() => {
  if (activeTag.value || selectedDate.value || debouncedQuery.value || typeFilter.value)
    return t('flash-moment.flash.emptyNoMatch')
  return showArchive.value ? t('flash-moment.flash.emptyArchive') : undefined
})

async function refreshArchived() {
  if (archiveLoading.value) return
  const version = ++archiveVersion
  archiveLoading.value = true
  archiveError.value = null
  try {
    const result = await loadArchived()
    if (version !== archiveVersion || !isLoggedIn.value) return
    archivedNotes.value = result
    archiveLoaded.value = true
  } catch (cause) {
    if (version === archiveVersion)
      archiveError.value = cause instanceof Error ? cause.message : t('flash-moment.flash.archiveLoadFailed')
  } finally {
    if (version === archiveVersion) archiveLoading.value = false
  }
}

async function retryList() {
  if (listPending.value) return
  if (showArchive.value) await refreshArchived()
  else {
    // 概览随列表一起失败时同步重试；已就绪且未过期时 loadOverview 直接返回
    void loadOverview()
    await load(true)
  }
}

onBeforeUnmount(() => {
  archiveVersion += 1
})

async function toggleArchiveView() {
  showArchive.value = !showArchive.value
  if (showArchive.value) await refreshArchived()
}

async function onToggleLike(id: string) {
  if (pendingIds.value.includes(id)) return
  pendingIds.value.push(id)
  try {
    await toggleLike(id)
    const changed = notes.value.find((note) => note.id === id)
    success(changed?.liked ? t('flash-moment.flash.toastLiked') : t('flash-moment.flash.toastUnliked'))
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastLikeFailed'))
  } finally {
    pendingIds.value = pendingIds.value.filter((value) => value !== id)
  }
}

async function onAddComment(payload: FlashCommentSubmission) {
  if (pendingIds.value.includes(payload.noteId)) {
    payload.complete?.(false)
    return
  }
  if (!isLoggedIn.value && !hasIdentity.value) {
    pendingComment = payload
    identityModalVisible.value = true
    return
  }
  pendingIds.value.push(payload.noteId)
  try {
    const guest = guestIdentity.value
    const created = await addComment(
      payload.noteId,
      payload.content,
      !isLoggedIn.value && guest ? { id: guest.id, name: guest.nickname, avatar: resolveAvatar() } : undefined,
      { website: payload.website, formElapsedMs: payload.formElapsedMs },
    )
    payload.complete?.(!!created)
    if (created) success(commentSubmittedMessage(created, t))
  } catch (cause) {
    payload.complete?.(false)
    showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastCommentFailed'))
  } finally {
    pendingIds.value = pendingIds.value.filter((value) => value !== payload.noteId)
  }
}

function closeSearch() {
  searchExpanded.value = false
  nextTick(() => searchButtonRef.value?.focus())
}
function clearFilters() {
  activeTag.value = null
  selectedDate.value = null
  typeFilter.value = null
  searchQuery.value = ''
  debouncedQuery.value = ''
  if (searchTimer) clearTimeout(searchTimer)
}
function loginForComment() {
  cancelIdentity()
  openLoginDrawer('login')
}
function cancelIdentity() {
  identityModalVisible.value = false
  pendingComment?.complete?.(false)
  pendingComment = null
}
function onIdentityConfirm() {
  identityModalVisible.value = false
  if (pendingComment) {
    const pending = pendingComment
    pendingComment = null
    void onAddComment(pending)
  }
}
async function onRemoveComment(payload: { noteId: string; commentId: string }) {
  try {
    await removeComment(payload.noteId, payload.commentId)
    success(t('flash-moment.flash.toastCommentDeleted'))
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastDeleteFailed'))
  }
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
/* 与同排 RSS 入口及全站页头紧凑按钮（筛选抽屉入口等）同一规范：44px 触控高度、13px 文字、浅底描边 */
.flash-page__search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--border-hover);
    background: var(--surface-3);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  &.is-active {
    color: var(--accent-text);
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
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-3);
  }

  // 当前项白字需 ≥4.5:1：统一用深一档的操作色
  &.is-active {
    color: #fff;
    background: var(--accent-action);
  }

  // type 专属配色
  &[data-type='idea'].is-active {
    background: #a15104;
  }

  &[data-type='todo'].is-active {
    background: #2563eb;
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
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.flash-page__filter-label {
  flex: 1;

  strong {
    color: var(--accent-text);
  }
}

.flash-page__filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  transition: opacity 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  width: 100%;

  &:hover {
    border-style: solid;
    transform: translateY(-1px);
  }
}

.flash-page__guest-banner-icon {
  flex-shrink: 0;
  color: var(--accent-text);
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
  color: var(--accent-text);
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
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  width: 100%;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
}

.flash-ai-card__icon {
  flex-shrink: 0;
  color: var(--accent-text);
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
  color: var(--accent-text);
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
  color: var(--accent-text);
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  padding: 0.125rem 0.375rem;
  border-radius: $radius-full;
  transition:
    opacity 0.2s,
    background 0.2s,
    color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.7;
  }

  &--active {
    background: var(--accent-action);
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
