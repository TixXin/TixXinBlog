<!-- @file prompts.vue @description 灵感图鉴：真实图片提示词、URL 筛选与详情，博主页内发布和编辑 -->
<template>
  <CommonPageFrame class="main-inner prompts-page" header-key="prompts">
    <template #header
      ><CommonPageHeader
        :title="$t('misc.prompt.page.title')"
        :subtitle="$t('misc.prompt.page.subtitle')"
        icon="lucide:aperture"
        ><template #action
          ><button v-if="isOwner" type="button" class="prompts-add" :disabled="!ready" @click="openEditor(null)">
            <Icon name="lucide:plus" size="16" /><span>{{ $t('misc.prompt.page.share') }}</span>
          </button></template
        ></CommonPageHeader
      ></template
    >
    <CommonCustomScrollbar
      tabindex="-1"
      class="prompts-body"
      viewport-class="prompts-viewport"
      :show-back-to-top="false"
      :preserved-query-keys="['prompt', 'edit']"
      primary
    >
      <PromptIntro :metadata="metadata" />
      <PromptAuthBanner
        v-if="ready && !isOwner && (managementIntent || authError)"
        :auth-error="authError"
        :restoring-pending="restoringPending"
        @restore="auth.restore()"
        @login="login.open('login', true)"
      />
      <PromptToolbar
        v-model:keyword="keyword"
        :ready="ready"
        :draft-view="draftView"
        :is-owner="isOwner"
        :metadata="metadata"
        :query="query"
        :filtered="filtered"
        :current-error="currentError"
        :current-pending="currentPending"
        :current-stale="currentStale"
        :total="total"
        @change-query="changeQuery"
        @set-view="setView"
        @submit-search="submitSearch"
        @start-composition="startComposition"
        @end-composition="endComposition"
      />
      <PromptFeedState
        :draft-view="draftView"
        :current-pending="currentPending"
        :page-out-of-range="pageOutOfRange"
        :current-error="currentError"
        :has-items="items.length > 0"
        :metadata-error="metadataError"
        :metadata-retrying="metadataRetrying"
        :metadata-pending="metadataPending"
        :draft-stale="draftStale"
        :stale="stale"
        @retry="retry"
        @retry-metadata="retryMetadata"
      />
      <CommonStateBlock
        v-if="!currentPending && !pageOutOfRange && !currentError && !items.length"
        icon="lucide:aperture"
        :title="
          filtered
            ? $t('misc.prompt.page.emptyFilteredTitle')
            : draftView
              ? $t('misc.prompt.page.emptyDraftTitle')
              : $t('misc.prompt.page.emptyTitle')
        "
        :description="
          filtered
            ? $t('misc.prompt.page.emptyFilteredHint')
            : draftView
              ? $t('misc.prompt.page.emptyDraftHint')
              : $t('misc.prompt.page.emptyHint')
        "
        :action-label="
          filtered ? $t('misc.prompt.page.clearFilters') : isOwner ? $t('misc.prompt.page.emptyShareFirst') : undefined
        "
        @action="filtered ? changeQuery({ q: undefined, model: undefined, tag: undefined }) : openEditor(null)"
      />
      <PromptGrid
        v-else
        :items="items"
        :ready="ready"
        :editable="isOwner"
        :draft="draftView"
        @open="openDetail"
        @edit="openEditor"
      />
      <PromptPagination
        :total="total"
        :page-out-of-range="pageOutOfRange"
        :has-items="items.length > 0"
        :page="query.page"
        :page-count="pageCount"
        :draft-view="draftView"
        :ready="ready"
        :current-pending="currentPending"
        @change-page="changeQuery({ page: $event })"
      />
    </CommonCustomScrollbar>
    <template #overlays
      ><ClientOnly
        ><PromptDetail
          :visible="selectedId !== null && !editorOpen && (isOwner || !managementIntent)"
          :item="selectedItem"
          :pending="detailPending"
          :error="detailError"
          :editable="isOwner"
          :draft="selectedDraft"
          :position="navigationIndex + 1"
          :navigation-count="navigationIndex >= 0 ? items.length : 0"
          :can-previous="navigationIndex > 0 && !detailPending"
          :can-next="navigationIndex >= 0 && navigationIndex < items.length - 1 && !detailPending"
          @previous="moveDetail(-1)"
          @next="moveDetail(1)"
          @close="closeDetail"
          @retry="readDetail"
          @edit="openEditor" /><PromptEditor
          v-if="editorOpen"
          :id="editorId"
          :key="editorSession"
          :models="metadata?.models.map((item) => item.label) || []"
          @close="closeEditor"
          @saved="saved" /></ClientOnly
    ></template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { promptId } from '~/features/prompt/query'
import { usePromptSearch } from '~/composables/usePromptSearch'
import { usePromptDetail } from '~/composables/usePromptDetail'
import { usePromptSeo } from '~/composables/usePromptSeo'
import { usePromptEditorSession } from '~/features/prompt/usePromptEditorSession'
import { usePromptDetailInteraction } from '~/features/prompt/usePromptDetailInteraction'

definePageMeta({ rightSidebar: false })
const route = useRoute(),
  router = useRouter(),
  auth = useCurrentUser()
const { isLoggedIn: isOwner, authError, restoringPending } = auth
const login = useLoginDrawer()
const managementIntent = computed(() => route.query.edit !== undefined || route.query.view === 'drafts')
const editToken = computed(() =>
  route.query.edit === 'new' ? 'new' : (promptId(route.query.edit)?.toString() ?? null),
)
const {
  query,
  ready,
  prompts,
  total: publicTotal,
  stale,
  pending,
  error,
  refresh,
  metadata,
  metadataPending,
  metadataError,
  refreshMetadata,
  changeQuery,
} = await usePrompts()
const metadataRetrying = ref(false)
async function retryMetadata() {
  if (metadataPending.value) return
  metadataRetrying.value = true
  try {
    await refreshMetadata()
  } finally {
    metadataRetrying.value = false
  }
}
const draftView = computed(() => isOwner.value && route.query.view === 'drafts')
const {
  drafts,
  pending: draftPending,
  error: draftError,
  stale: draftStale,
  refresh: loadDrafts,
} = usePromptDrafts(query, draftView)
const items = computed(() => (draftView.value ? (drafts.value?.items ?? []) : prompts.value))
const total = computed(() => (draftView.value ? (drafts.value?.total ?? null) : publicTotal.value))
const currentPending = computed(() => (draftView.value ? draftPending.value : pending.value))
const currentError = computed(() => (draftView.value ? draftError.value : error.value?.message || ''))
const currentStale = computed(() => (draftView.value ? draftStale.value : stale.value))
const pageCount = computed(() => Math.max(1, Math.ceil((total.value ?? 0) / query.value.pageSize)))
const pageOutOfRange = computed(
  () =>
    total.value !== null &&
    !currentPending.value &&
    !currentError.value &&
    !currentStale.value &&
    query.value.page > pageCount.value,
)
const { selectedId, selectedItem, selectedDraft, detailPending, detailError, readDetail } = await usePromptDetail(
  ready,
  draftView,
)
const { editorOpen, editorId, editorSession, openEditor, closeEditor, saved } = usePromptEditorSession({
  isOwner,
  ready,
  editToken,
  draftView,
  selectedId,
  refresh,
  refreshMetadata,
  loadDrafts,
  readDetail,
})
const { navigationIndex, openDetail, moveDetail, closeDetail } = usePromptDetailInteraction({
  selectedId,
  detailPending,
  items,
  currentPending,
  currentStale,
  currentError,
  editorOpen,
})
const { keyword, submit: submitSearch, startComposition, endComposition, replacePreservingInput } = usePromptSearch()
const filtered = computed(() => !!query.value.q || !!query.value.model || !!query.value.tag)
usePromptSeo({ selectedId, selectedItem, selectedDraft, editorOpen, prompts })
function setView(draft: boolean) {
  void router.push({
    path: '/prompts',
    query: { ...route.query, view: draft ? 'drafts' : undefined, page: undefined, prompt: undefined },
  })
}
function retry() {
  if (draftView.value) void loadDrafts()
  else void refresh()
}
watch(
  [pageOutOfRange, ready, pageCount],
  () => {
    if (!ready.value || !pageOutOfRange.value) return
    void replacePreservingInput({
      path: '/prompts',
      query: { ...route.query, page: pageCount.value === 1 ? undefined : String(pageCount.value) },
    })
  },
  { immediate: true },
)
onMounted(() => void auth.restore())
</script>
<style scoped lang="scss">
.prompts-body {
  flex: 1;
  padding: 0;
}
:deep(.prompts-viewport) {
  padding: 1.4rem 2rem 2rem;
}
.prompts-add {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  font-size: 0.75rem;
  color: var(--text-main);
  background: var(--surface-2);
  transition:
    background-color 0.16s,
    border-color 0.16s,
    color 0.16s;
}
.prompts-add:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .prompts-add {
    transition: none;
  }
}
@media (max-width: 640px) {
  :deep(.prompts-viewport) {
    padding: 1rem;
  }
  .prompts-add {
    padding-inline: 0.65rem;
  }
}
</style>
