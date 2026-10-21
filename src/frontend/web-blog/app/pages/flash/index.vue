<!--
  @file index.vue
  @description 闪念主页：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <CommonPageFrame class="main-inner flash-page" header-key="flash">
    <template #header>
      <FlashPageHeader
        v-model:search-expanded="filter.searchExpanded.value"
        v-model:search-query="filter.searchQuery.value"
        :is-logged-in="isLoggedIn"
        :show-archive="archive.showArchive.value"
        :debounced-query="filter.debouncedQuery.value"
        :result-count="filter.resultCount.value"
        @toggle-archive="archive.toggleArchiveView"
        @close-search="filter.closeSearch"
      />
    </template>
    <template #default>
      <CommonCustomScrollbar class="flash-page__body" viewport-class="flash-page__viewport" primary>
        <div class="flash-page__content">
          <FlashPageFilters
            v-model:type-filter="filter.typeFilter.value"
            :is-logged-in="isLoggedIn"
            :type-tabs="filter.typeTabs.value"
            :active-tag="filter.activeTag.value"
            :selected-date="filter.selectedDate.value"
            :debounced-query="filter.debouncedQuery.value"
            :filter-summary="filter.filterSummary.value"
            :result-count="filter.resultCount.value"
            @login="onLogin"
            @clear-filters="filter.clearFilters"
          />

          <CommonRequestFeedback
            v-if="flash.overviewError.value || overviewRetrying"
            compact
            :pending="flash.overviewLoading.value"
            :title="$t('flash-moment.flash.overviewFailed')"
            :description="$t('flash-moment.flash.overviewFailedDesc')"
            @retry="retryOverview"
          />

          <FlashNoteList
            :notes="filter.matchedNotes.value"
            :pending-ids="interactions.pendingIds.value"
            :loading="archive.listPending.value"
            :error-message="archive.listError.value"
            :empty-message="filter.emptyMessage.value"
            :read-only="flash.isReadOnly.value"
            :current-user-id="currentUserId"
            :guest-id="guestId"
            :highlighted-id="highlightedNoteId"
            :has-more="archive.listHasMore.value"
            :more-pending="archive.listMorePending.value"
            :more-error="archive.listMoreError.value"
            @retry="archive.retryList"
            @more="archive.onMore"
            @remove="interactions.onRemove"
            @edit="composer.onEdit"
            @toggle-like="interactions.onToggleLike"
            @set-pinned="interactions.onSetPinned"
            @set-archived="interactions.onSetArchived"
            @add-comment="interactions.onAddComment"
            @remove-comment="interactions.onRemoveComment"
            @tag-click="filter.onTagFilter"
          />
        </div>
      </CommonCustomScrollbar>

      <!-- 底部发布输入框：仅登录者可见 -->
      <div v-if="isLoggedIn" class="flash-page__composer-wrap">
        <div class="flash-page__composer">
          <p v-if="composer.editingNote.value">
            {{ $t('flash-moment.flash.editing') }}
            <button type="button" @click="composer.cancelEdit">{{ $t('flash-moment.flash.cancelEdit') }}</button>
          </p>
          <FlashEditor
            :key="composer.editorVersion.value"
            ref="editorRef"
            :initial="composer.editingNote.value"
            :submitting="composer.publishing.value || flash.loading.value"
            @submit="composer.onSubmit"
            @dirty="composer.editorDirty.value = $event"
          />
        </div>
      </div>
    </template>

    <template #overlays>
      <!-- 右栏内容交给能力位门控组件：主题未声明 rightSidebar 时自然不渲染 -->
      <CommonThemeSidebarPortal>
        <SidebarRightSidebar>
          <FlashPageSidebar
            :is-logged-in="isLoggedIn"
            :total-count="flash.totalCount.value"
            :monthly-count="flash.monthlyCount.value"
            :aggregates-ready="flash.aggregatesReady.value"
            :overview="flash.overview.value"
            :selected-date="filter.selectedDate.value"
            :tag-cloud="flash.tagCloud.value"
            :active-tag="filter.activeTag.value"
            @ai-click="onAiClick"
            @select-date="filter.onSelectDate"
            @tag-filter="filter.onTagFilter"
          />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
      <FlashAISearchModal v-model:visible="aiModalVisible" :notes="flash.notes.value" @cite-click="onCiteClick" />
      <CommonGuestIdentityModal
        :visible="interactions.identityModalVisible.value"
        @confirm="interactions.onIdentityConfirm"
        @cancel="interactions.cancelIdentity"
        @login="interactions.loginForComment"
      />
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { useFlashFilterState } from '~/features/flash/useFlashFilterState'
import { useFlashArchiveState } from '~/features/flash/useFlashArchiveState'
import { useFlashCitation } from '~/features/flash/useFlashCitation'
import { useFlashComposer } from '~/features/flash/useFlashComposer'
import { useFlashCardInteractions } from '~/features/flash/useFlashCardInteractions'

const { t } = useI18n()

usePageSeo({
  title: () => t('flash-moment.flash.seoTitle'),
  description: () => t('flash-moment.flash.seoDescription'),
  type: 'website',
})

const { isLoggedIn, currentUser } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const { guestIdentity } = useGuestIdentity()
const flash = useFlashNotes()

const overviewRetrying = ref(false)
async function retryOverview() {
  if (flash.overviewLoading.value) return
  overviewRetrying.value = true
  try {
    await flash.loadOverview(true)
  } finally {
    overviewRetrying.value = false
  }
}

const currentUserId = computed(() => currentUser.value?.id ?? null)
const guestId = computed(() => guestIdentity.value?.id ?? null)
const aiModalVisible = ref(false)
const editorRef = ref<{ focus: () => void } | null>(null)

const archive = useFlashArchiveState({
  isLoggedIn,
  storageError: flash.error,
  loading: flash.loading,
  loaded: flash.loaded,
  hasMore: flash.hasMore,
  moreLoading: flash.moreLoading,
  moreError: flash.moreError,
  loadArchived: flash.loadArchived,
  load: flash.load,
  loadMore: flash.loadMore,
  loadOverview: flash.loadOverview,
})

const filter = useFlashFilterState({
  notes: flash.notes,
  archivedNotes: archive.archivedNotes,
  showArchive: archive.showArchive,
  pagedPublic: flash.pagedPublic,
  total: flash.total,
  setPublicFilter: flash.setPublicFilter,
})

const { highlightedNoteId, onCiteClick } = useFlashCitation(filter.clearFilters)
const composer = useFlashComposer({ add: flash.add, update: flash.update })

const interactions = useFlashCardInteractions({
  notes: flash.notes,
  archivedNotes: archive.archivedNotes,
  refreshArchived: archive.refreshArchived,
  load: flash.load,
  remove: flash.remove,
  setPinned: flash.setPinned,
  setArchived: flash.setArchived,
  toggleLike: flash.toggleLike,
  addComment: flash.addComment,
  removeComment: flash.removeComment,
})

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

await useAsyncData('flash-public-first-page', async (app) => {
  if (import.meta.client && app.isHydrating) return true
  if (flash.pagedPublic.value) await flash.load(false, { rethrow: import.meta.server })
  return true
})

onMounted(() => {
  void flash.load()
  void flash.loadOverview()
})

watch(flash.ownerKey, () => {
  archive.resetArchive()
  void flash.load(true)
  void flash.loadOverview()
})
</script>

<style lang="scss" scoped>
.flash-page {
  display: flex;
  flex-direction: column;
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
</style>
