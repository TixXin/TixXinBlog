<!-- @file prompts.vue @description 灵感图鉴：真实图片提示词、URL 筛选与详情，博主页内发布和编辑 -->
<template>
  <CommonPageFrame class="main-inner prompts-page" header-key="prompts">
    <template #header
      ><CommonPageHeader title="灵感图鉴" subtitle="图像生成提示词与创作记录" icon="lucide:aperture"
        ><template #action
          ><button v-if="isOwner" type="button" class="prompts-add" :disabled="!ready" @click="openEditor(null)">
            <Icon name="lucide:plus" size="16" /><span>分享灵感</span>
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
      <section class="prompts-intro" aria-label="图片提示词分享">
        <div>
          <p class="prompts-kicker">IMAGE PROMPT COLLECTION</p>
          <h1>从一张图，<span>遇见一种想象。</span></h1>
          <p class="prompts-intro__description">打开喜欢的画面，查看完整提示词，让下一次创作有迹可循。</p>
        </div>
        <div v-if="metadata" class="prompts-intro__index" aria-label="公开提示词数量">
          <strong>{{ String(metadata.stats.prompts).padStart(2, '0') }}</strong
          ><span>条提示词</span><Icon name="lucide:move-up-right" size="22" />
        </div>
      </section>
      <div v-if="ready && !isOwner && (managementIntent || authError)" class="prompts-auth" role="status">
        <Icon name="lucide:lock-keyhole" size="18" />
        <div>
          <strong>{{ restoringPending ? '正在确认登录状态…' : authError || '博主登录后可继续编辑' }}</strong>
          <p>浏览和复制公开提示词无需登录。</p>
        </div>
        <button v-if="authError" type="button" :disabled="restoringPending" @click="auth.restore()">重新确认</button>
        <button type="button" :disabled="restoringPending" @click="login.open('login', true)">博主登录</button>
      </div>
      <div class="prompts-toolbar">
        <div class="prompts-views" aria-label="浏览范围">
          <button
            ref="publicViewButton"
            type="button"
            :aria-pressed="!draftView"
            :disabled="!ready"
            @click="setView(false)"
          >
            全部<span v-if="metadata">{{ metadata.stats.prompts }}</span></button
          ><button v-if="isOwner" type="button" :aria-pressed="draftView" :disabled="!ready" @click="setView(true)">
            <Icon name="lucide:file-pen-line" size="14" />我的草稿
          </button>
        </div>
        <CommonSearchBox
          v-model="keyword"
          :disabled="!ready"
          placeholder="搜索标题、提示词…"
          label="搜索图片提示词"
          @compositionstart="startComposition"
          @compositionend="endComposition"
          @keydown.enter="submitSearch"
        />
      </div>
      <div class="prompts-filters">
        <label
          ><Icon name="lucide:sliders-horizontal" size="14" /><select
            :value="query.model || ''"
            :disabled="!ready"
            aria-label="筛选生成模型"
            @change="changeQuery({ model: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option value="">全部模型</option>
            <option
              v-if="query.model && !metadata?.models.some((item) => item.label === query.model)"
              :value="query.model"
            >
              {{ query.model }}
            </option>
            <option v-for="model in metadata?.models || []" :key="model.label" :value="model.label">
              {{ model.label }} · {{ model.count }}
            </option>
          </select></label
        >
        <div class="prompts-tags" aria-label="筛选风格标签">
          <button type="button" :aria-pressed="!query.tag" :disabled="!ready" @click="changeQuery({ tag: undefined })">
            全部风格</button
          ><button
            v-for="tag in visibleTags"
            :key="tag.label"
            type="button"
            :aria-pressed="query.tag === tag.label"
            :disabled="!ready"
            @click="changeQuery({ tag: query.tag === tag.label ? undefined : tag.label })"
          >
            {{ tag.label }}
          </button>
          <button
            v-if="(metadata?.tags.length || 0) > 7"
            type="button"
            :aria-expanded="allTags"
            @click="allTags = !allTags"
          >
            {{ allTags ? '收起风格' : '更多风格'
            }}<Icon :name="allTags ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="12" />
          </button>
        </div>
        <button
          v-if="filtered"
          type="button"
          class="prompts-clear"
          @click="changeQuery({ q: undefined, model: undefined, tag: undefined })"
        >
          清除筛选
        </button>
      </div>
      <p v-if="draftView" class="prompts-result" role="status">
        <Icon name="lucide:lock-keyhole" size="13" />草稿仅自己可见，发布后才会出现在灵感图鉴。
      </p>
      <CommonRequestFeedback
        v-if="currentPending || pageOutOfRange || currentError"
        :pending="currentPending || pageOutOfRange"
        :compact="items.length > 0"
        :title="currentError || '正在寻找灵感'"
        @retry="retry"
      />
      <p v-if="metadataError" class="prompts-result" role="status">
        模型与标签暂时无法读取。<button type="button" @click="refreshMetadata()">重新读取</button>
      </p>
      <p v-if="draftView ? draftStale : stale" class="prompts-result" role="status">
        正在显示上次读取的{{ draftView ? '草稿' : '灵感' }}，{{
          currentError ? '本次读取未完成，可重试更新。' : '正在更新结果。'
        }}
      </p>
      <div v-if="filtered" class="prompts-selection" role="group" aria-label="当前筛选条件">
        <span>{{
          currentError
            ? '筛选暂未完成'
            : currentPending || (draftView ? draftStale : stale)
              ? '正在筛选…'
              : `找到 ${total ?? 0} 份${draftView ? '草稿' : '灵感'}`
        }}</span>
        <button
          v-if="query.q"
          type="button"
          :disabled="!ready"
          :aria-label="`移除关键词筛选：${query.q}`"
          @click="changeQuery({ q: undefined })"
        >
          <Icon name="lucide:search" size="12" /><span>{{ query.q }}</span
          ><Icon name="lucide:x" size="12" />
        </button>
        <button
          v-if="query.model"
          type="button"
          :disabled="!ready"
          :aria-label="`移除模型筛选：${query.model}`"
          @click="changeQuery({ model: undefined })"
        >
          <span>{{ query.model }}</span
          ><Icon name="lucide:x" size="12" />
        </button>
        <button
          v-if="query.tag"
          type="button"
          :disabled="!ready"
          :aria-label="`移除风格筛选：${query.tag}`"
          @click="changeQuery({ tag: undefined })"
        >
          <span>{{ query.tag }}</span
          ><Icon name="lucide:x" size="12" />
        </button>
      </div>
      <CommonStateBlock
        v-if="!currentPending && !pageOutOfRange && !currentError && !items.length"
        icon="lucide:aperture"
        :title="filtered ? '还没有这样的灵感' : draftView ? '这里留给下一次灵感' : '灵感正在酝酿'"
        :description="
          filtered
            ? '换个关键词或风格，或许会遇见惊喜。'
            : draftView
              ? '新建时可以先存为草稿，打磨好再分享。'
              : '新的图片提示词发布后，会出现在这里。'
        "
        :action-label="filtered ? '清除筛选' : isOwner ? '分享第一份灵感' : undefined"
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
      <footer v-if="total !== null && !pageOutOfRange && (items.length || query.page > 1)" class="prompts-bottom">
        <p>{{ total }} 份{{ draftView ? '草稿' : '灵感' }}<span> / </span>最新收录在前</p>
        <nav v-if="total > 12 || query.page > 1" aria-label="提示词分页">
          <button
            type="button"
            aria-label="上一页提示词"
            :disabled="!ready || currentPending || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            <Icon name="lucide:arrow-left" size="16" /></button
          ><span>{{ query.page }} / {{ pageCount }}</span
          ><button
            type="button"
            aria-label="下一页提示词"
            :disabled="!ready || currentPending || query.page * 12 >= total"
            @click="changeQuery({ page: query.page + 1 })"
          >
            <Icon name="lucide:arrow-right" size="16" />
          </button>
        </nav>
      </footer>
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
import type { ManagedPrompt } from '~/features/prompt/types'
import { promptId } from '~/features/prompt/query'
import { usePromptSearch } from '~/composables/usePromptSearch'
import { usePromptDetail } from '~/composables/usePromptDetail'
import { usePromptSeo } from '~/composables/usePromptSeo'
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
  metadataError,
  refreshMetadata,
  changeQuery,
} = await usePrompts()
const draftView = computed(() => isOwner.value && route.query.view === 'drafts')
const {
  drafts,
  pending: draftPending,
  error: draftError,
  stale: draftStale,
  refresh: loadDrafts,
} = usePromptDrafts(query, draftView)
const publicViewButton = ref<HTMLButtonElement | null>(null)
let editorTrigger: HTMLElement | null = null
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
const editorOpen = ref(false),
  editorId = ref<number | null>(null),
  editorSession = ref(0)
let activeEditToken: string | null = null
const navigationIndex = computed(() =>
  !currentPending.value && !currentStale.value && !currentError.value
    ? items.value.findIndex((item) => item.id === selectedId.value)
    : -1,
)
const { keyword, submit: submitSearch, startComposition, endComposition, replacePreservingInput } = usePromptSearch()
const filtered = computed(() => !!query.value.q || !!query.value.model || !!query.value.tag)
const allTags = ref(false)
const visibleTags = computed(() => {
  const tags = allTags.value ? [...(metadata.value?.tags ?? [])] : (metadata.value?.tags ?? []).slice(0, 7)
  if (query.value.tag && !tags.some((tag) => tag.label === query.value.tag))
    tags.push({ label: query.value.tag, count: 0 })
  return tags
})
usePromptSeo({ selectedId, selectedItem, selectedDraft, editorOpen, prompts })
function setView(draft: boolean) {
  void router.push({
    path: '/prompts',
    query: { ...route.query, view: draft ? 'drafts' : undefined, page: undefined, prompt: undefined },
  })
}
function openDetail(id: number) {
  void router.push({ path: '/prompts', query: { ...route.query, prompt: String(id) } })
}
function moveDetail(direction: -1 | 1) {
  if (detailPending.value || navigationIndex.value < 0) return
  const next = items.value[navigationIndex.value + direction]
  if (next) void router.replace({ path: '/prompts', query: { ...route.query, prompt: String(next.id) } })
}
async function closeDetail() {
  const previousId = selectedId.value
  await router.replace({ path: '/prompts', query: { ...route.query, prompt: undefined } })
  await nextTick()
  if (selectedId.value !== null || editorOpen.value) return
  const card = document.querySelector<HTMLElement>(`[data-focus-key="prompt-open-${previousId}"]`)
  if (card) card.focus({ preventScroll: true })
  else publicViewButton.value?.focus()
}
function openEditor(id: number | null) {
  if (!isOwner.value) return
  editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void router.push({ path: '/prompts', query: { ...route.query, edit: id === null ? 'new' : String(id) } })
}
async function restoreEditorFocus() {
  await nextTick()
  if (editorOpen.value || selectedId.value !== null) return
  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    active !== document.body &&
    active !== document.documentElement &&
    active.isConnected &&
    !active.closest('.prompt-editor, [inert]')
  )
    return
  if (editorTrigger?.isConnected && !editorTrigger.closest('[inert]')) editorTrigger.focus({ preventScroll: true })
  else publicViewButton.value?.focus()
}
async function closeEditor() {
  // 导航守卫是未保存确认的唯一入口；被取消时URL和编辑器都保持原样。
  await router.replace({ path: '/prompts', query: { ...route.query, edit: undefined } })
}
async function saved(item: ManagedPrompt) {
  // 状态改变时转到对应列表；关闭编辑器后仍可核对该作品，草稿不会误走公开详情。
  const nextView = item.status === 'draft' ? 'drafts' : undefined
  const switchView = draftView.value !== (item.status === 'draft')
  // 保存后的new→id是同一编辑会话，不重建组件，后续输入归属已确认作品。
  editorId.value = item.id
  if (switchView || route.query.edit !== String(item.id))
    await router.replace({
      path: '/prompts',
      query: { ...route.query, edit: String(item.id), view: nextView, page: switchView ? undefined : route.query.page },
    })
  await Promise.all([refresh(), refreshMetadata(), !switchView && draftView.value ? loadDrafts() : Promise.resolve()])
  if (!switchView && selectedId.value === item.id) await readDetail()
}
function retry() {
  if (draftView.value) void loadDrafts()
  else void refresh()
}
watch(
  [pageOutOfRange, ready, pageCount],
  () => {
    if (!ready.value || !pageOutOfRange.value) return
    // 只依据当前查询的成功结果修正页码；失败或旧列表不能把用户带到其它页。
    void replacePreservingInput({
      path: '/prompts',
      query: { ...route.query, page: pageCount.value === 1 ? undefined : String(pageCount.value) },
    })
  },
  { immediate: true },
)
watch(
  [isOwner, editToken, ready],
  () => {
    const token = editToken.value
    const sameSession =
      token && (activeEditToken === token || (activeEditToken === 'new' && token === String(editorId.value)))
    if (editorOpen.value && sameSession) {
      activeEditToken = token
      return
    }
    if (!isOwner.value || !ready.value || !token) {
      const wasOpen = editorOpen.value
      editorOpen.value = false
      activeEditToken = null
      if (wasOpen) void restoreEditorFocus()
      return
    }
    activeEditToken = token
    editorId.value = token === 'new' ? null : Number(token)
    editorSession.value++
    editorOpen.value = true
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
}
.prompts-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.2rem 0 1.35rem;
  border-bottom: 1px solid var(--border);
}
.prompts-kicker {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: var(--text-soft);
  font-weight: 500;
}
h1 {
  font-size: clamp(1.4rem, 2.7vw, 2.25rem);
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1.5;
  margin: 0.6rem 0;
  color: var(--text-main);
}
h1 span {
  color: var(--text-soft);
}
.prompts-intro__description {
  color: var(--text-soft);
  font-size: 0.78rem;
  line-height: 1.8;
}
.prompts-intro__index {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 1rem;
  min-width: 120px;
  color: var(--text-soft);
}
.prompts-intro__index strong {
  font-variant-numeric: tabular-nums;
  font-size: 2.8rem;
  line-height: 1.2;
  font-weight: 300;
  letter-spacing: -0.05em;
  color: var(--text-main);
}
.prompts-intro__index span {
  grid-column: 1 / -1;
  grid-row: 2;
  font-size: 0.6rem;
  padding-top: 0.4rem;
}
.prompts-intro__index > :last-child {
  align-self: center;
  grid-column: 2;
  grid-row: 1;
}
.prompts-auth {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  color: var(--text-muted);
  background: var(--surface-2);
}
.prompts-auth > div {
  flex: 1;
  min-width: 160px;
}
.prompts-auth strong {
  font-size: 0.8rem;
  font-weight: 500;
}
.prompts-auth p {
  font-size: 0.72rem;
  margin-top: 0.25rem;
  color: var(--text-soft);
}
.prompts-auth button {
  min-height: 40px;
  color: var(--accent-text);
  font-size: 0.75rem;
}
.prompts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0 0.65rem;
}
.prompts-views {
  display: flex;
  gap: 1.25rem;
}
.prompts-views button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 42px;
  color: var(--text-soft);
  font-size: 0.8rem;
  border-bottom: 2px solid transparent;
}
.prompts-views button[aria-pressed='true'] {
  color: var(--text-main);
  border-color: var(--accent);
}
.prompts-views button span {
  font-size: 0.6rem;
  color: var(--text-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  background: var(--surface-2);
}
.prompts-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}
.prompts-filters label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-soft);
}
.prompts-filters select {
  max-width: 170px;
  min-height: 38px;
  background: transparent;
  border: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}
.prompts-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.prompts-tags button {
  min-height: 34px;
  font-size: 0.72rem;
  padding: 0.35rem 0.7rem;
  border-radius: 2rem;
  border: 1px solid transparent;
  color: var(--text-soft);
}
.prompts-tags button[aria-pressed='true'] {
  color: var(--text-main);
  background: var(--surface-2);
  border-color: var(--border);
}
.prompts-clear {
  color: var(--accent-text);
  font-size: 0.7rem;
  min-height: 38px;
  margin-left: auto;
}
.prompts-result {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 1rem;
}
.prompts-result button {
  color: var(--accent-text);
}
.prompts-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: -0.25rem 0 1.25rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompts-selection > span {
  margin-right: 0.25rem;
  font-variant-numeric: tabular-nums;
}
.prompts-selection button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  min-height: 36px;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
}
.prompts-selection button span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.prompts-selection button:hover {
  border-color: var(--accent);
}
.prompts-tags button,
.prompts-add,
.prompts-bottom nav button {
  transition:
    background-color 0.16s,
    border-color 0.16s,
    color 0.16s;
}
.prompts-tags button:hover,
.prompts-add:hover,
.prompts-bottom nav button:not(:disabled):hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
@media (prefers-reduced-motion: reduce) {
  .prompts-tags button,
  .prompts-add,
  .prompts-bottom nav button {
    transition: none;
  }
}
.prompts-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 0 0.5rem;
  border-top: 1px solid var(--border);
}
.prompts-bottom p {
  font-size: 0.67rem;
  color: var(--text-soft);
}
.prompts-bottom p span {
  margin-inline: 0.5rem;
}
.prompts-bottom nav {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-soft);
}
.prompts-bottom nav button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--text-main);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 1050px) {
  .prompts-intro__index {
    min-width: auto;
  }
}
@media (max-width: 640px) {
  :deep(.prompts-viewport) {
    padding: 1rem;
  }
  .prompts-intro {
    padding-bottom: 0.9rem;
    gap: 1rem;
  }
  h1 {
    font-size: 1.3rem;
  }
  h1 span {
    display: block;
  }
  .prompts-intro__description {
    max-width: 240px;
    font-size: 0.72rem;
  }
  .prompts-intro__index strong {
    font-size: 2.2rem;
  }
  .prompts-intro__index span {
    width: 80px;
    font-size: 0.55rem;
  }
  .prompts-intro__index > :last-child {
    display: none;
  }
  .prompts-kicker {
    font-size: 0.5rem;
  }
  .prompts-toolbar {
    gap: 0.75rem;
  }
  .prompts-toolbar :deep(.search-box) {
    width: 100%;
    max-width: none;
  }
  .prompts-add {
    padding-inline: 0.65rem;
  }
  .prompts-filters {
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .prompts-tags {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
    padding-block: 0.15rem;
  }
  .prompts-tags button {
    flex-shrink: 0;
    min-height: 40px;
  }
  .prompts-bottom p {
    line-height: 1.8;
  }
}
</style>
