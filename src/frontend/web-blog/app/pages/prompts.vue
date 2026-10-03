<!-- @file prompts.vue @description 灵感图鉴：真实图片提示词、URL 筛选与详情，博主页内发布和编辑 -->
<template>
  <CommonPageFrame class="main-inner prompts-page" header-key="prompts">
    <template #header
      ><CommonPageHeader title="灵感图鉴" subtitle="收藏画面的可能，也分享创作的起点" icon="lucide:aperture"
        ><template #action
          ><button v-if="isOwner" type="button" class="prompts-add" :disabled="!ready" @click="openEditor(null)">
            <Icon name="lucide:plus" size="16" /><span>分享灵感</span>
          </button></template
        ></CommonPageHeader
      ></template
    >
    <CommonCustomScrollbar
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
          <p class="prompts-intro__description">光影、材质、天马行空。找到喜欢的画面，带走它的提示词。</p>
        </div>
        <div v-if="metadata" class="prompts-intro__index" aria-label="公开灵感数量">
          <strong>{{ String(metadata.stats.prompts).padStart(2, '0') }}</strong
          ><span>份灵感，持续生长</span><Icon name="lucide:move-up-right" size="22" />
        </div>
      </section>
      <div class="prompts-toolbar">
        <div class="prompts-views" aria-label="浏览范围">
          <button type="button" :aria-pressed="!draftView" :disabled="!ready" @click="setView(false)">
            全部灵感<span v-if="metadata">{{ metadata.stats.prompts }}</span></button
          ><button v-if="isOwner" type="button" :aria-pressed="draftView" :disabled="!ready" @click="setView(true)">
            <Icon name="lucide:file-pen-line" size="14" />我的草稿
          </button>
        </div>
        <CommonSearchBox v-model="keyword" placeholder="搜索画面、提示词…" label="搜索图片提示词" />
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
        v-if="currentPending || currentError"
        :pending="currentPending"
        :compact="items.length > 0"
        :title="currentError || '正在寻找灵感'"
        @retry="retry"
      />
      <p v-if="metadataError" class="prompts-result" role="status">
        模型与标签暂时无法读取。<button type="button" @click="refreshMetadata()">重新读取</button>
      </p>
      <p v-if="stale && !draftView" class="prompts-result" role="status">正在显示上次读取的灵感，当前筛选尚未完成。</p>
      <CommonStateBlock
        v-if="!currentPending && !currentError && !items.length"
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
      <div v-else class="prompts-grid">
        <PromptCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :ready="ready"
          :editable="isOwner"
          :status="draftView ? 'draft' : 'published'"
          @open="openDetail"
          @edit="openEditor"
        />
      </div>
      <footer v-if="total !== null && (items.length || query.page > 1)" class="prompts-bottom">
        <p>{{ total }} 份{{ draftView ? '草稿' : '灵感' }}<span> / </span>每一次尝试，都值得被记录</p>
        <nav v-if="total > 12 || query.page > 1" aria-label="提示词分页">
          <button
            type="button"
            aria-label="上一页提示词"
            :disabled="!ready || currentPending || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            <Icon name="lucide:arrow-left" size="16" /></button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span
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
          :visible="selectedId !== null && !editorOpen"
          :item="selectedItem"
          :pending="detailPending"
          :error="detailError"
          :editable="isOwner"
          :draft="selectedDraft"
          @close="closeDetail"
          @retry="readDetail"
          @edit="openEditor" /><PromptEditor
          v-if="editorOpen"
          :id="editorId"
          :key="editorId ?? 'new'"
          :models="metadata?.models.map((item) => item.label) || []"
          @close="closeEditor"
          @saved="saved" /></ClientOnly
    ></template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import type { ImagePrompt, ManagedPrompt, PromptPage } from '~/features/prompt/types'
import { promptId } from '~/features/prompt/query'
definePageMeta({ rightSidebar: false })
const route = useRoute(),
  router = useRouter(),
  repo = usePromptRepository(),
  auth = useCurrentUser()
const { isLoggedIn: isOwner } = auth
const context = useState<string>('page-content-context', () => '')
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
const drafts = ref<PromptPage<ManagedPrompt> | null>(null),
  draftPending = ref(false),
  draftError = ref('')
let draftGeneration = 0,
  detailGeneration = 0,
  alive = true
const items = computed(() => (draftView.value ? (drafts.value?.items ?? []) : prompts.value))
const total = computed(() => (draftView.value ? (drafts.value?.total ?? null) : publicTotal.value))
const currentPending = computed(() => (draftView.value ? draftPending.value : pending.value))
const currentError = computed(() => (draftView.value ? draftError.value : error.value?.message || ''))
const selectedId = computed(() => promptId(route.query.prompt)),
  selectedItem = ref<ImagePrompt | null>(null)
const selectedDraft = ref(false),
  detailPending = ref(false),
  detailError = ref('')
const editorOpen = ref(false),
  editorId = ref<number | null>(null)
let detailController: AbortController | undefined
const keyword = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => {
    void router.replace({
      path: '/prompts',
      query: { ...route.query, q: q || undefined, page: undefined, prompt: undefined },
    })
  },
})
const filtered = computed(() => !!query.value.q || !!query.value.model || !!query.value.tag)
const allTags = ref(false)
const visibleTags = computed(() => {
  const tags = allTags.value ? [...(metadata.value?.tags ?? [])] : (metadata.value?.tags ?? []).slice(0, 7)
  if (query.value.tag && !tags.some((tag) => tag.label === query.value.tag))
    tags.push({ label: query.value.tag, count: 0 })
  return tags
})
useSeoMeta({
  title: '灵感图鉴 · 图片提示词',
  description: '收藏画面的可能，也分享创作的起点。浏览图片效果与完整提示词，找到属于自己的灵感。',
  ogType: 'website',
  ogImage: () => prompts.value[0]?.imageUrl,
})
async function loadDrafts() {
  const generation = ++draftGeneration
  if (!draftView.value) {
    draftPending.value = false
    drafts.value = null
    return
  }
  const actor = auth.currentUser.value?.id,
    ownedContext = context.value
  draftPending.value = true
  draftError.value = ''
  try {
    const result = await repo.adminList({ ...query.value, status: 'draft' })
    if (
      alive &&
      generation === draftGeneration &&
      auth.currentUser.value?.id === actor &&
      context.value === ownedContext
    )
      drafts.value = result
  } catch (cause) {
    if (alive && generation === draftGeneration)
      draftError.value = cause instanceof Error ? cause.message : '草稿读取失败。'
  } finally {
    if (alive && generation === draftGeneration) draftPending.value = false
  }
}
async function readDetail() {
  const generation = ++detailGeneration
  detailController?.abort()
  const id = selectedId.value
  selectedItem.value = null
  selectedDraft.value = false
  detailError.value = ''
  detailPending.value = false
  if (!id || !ready.value) return
  const controller = new AbortController()
  detailController = controller
  const actor = auth.currentUser.value?.id,
    ownedContext = context.value,
    admin = draftView.value
  detailPending.value = true
  try {
    const item = admin ? await repo.adminDetail(id) : await repo.detail(id, controller.signal)
    if (
      !alive ||
      generation !== detailGeneration ||
      controller.signal.aborted ||
      (admin && (auth.currentUser.value?.id !== actor || context.value !== ownedContext))
    )
      return
    selectedItem.value = item
    selectedDraft.value = admin && (item as ManagedPrompt).status === 'draft'
  } catch (cause) {
    if (alive && generation === detailGeneration && !controller.signal.aborted)
      detailError.value = cause instanceof Error ? cause.message : '提示词读取失败。'
  } finally {
    if (alive && generation === detailGeneration) detailPending.value = false
  }
}
function setView(draft: boolean) {
  void router.push({
    path: '/prompts',
    query: { ...route.query, view: draft ? 'drafts' : undefined, page: undefined, prompt: undefined },
  })
}
function openDetail(id: number) {
  void router.push({ path: '/prompts', query: { ...route.query, prompt: String(id) } })
}
function closeDetail() {
  void router.replace({ path: '/prompts', query: { ...route.query, prompt: undefined } })
}
function openEditor(id: number | null) {
  if (!isOwner.value) return
  editorId.value = id
  editorOpen.value = true
}
function closeEditor() {
  editorOpen.value = false
  if (route.query.edit) void router.replace({ path: '/prompts', query: { ...route.query, edit: undefined } })
}
async function saved(item: ManagedPrompt) {
  await Promise.all([refresh(), refreshMetadata(), draftView.value ? loadDrafts() : Promise.resolve()])
  if (selectedId.value === item.id) await readDetail()
}
function retry() {
  if (draftView.value) void loadDrafts()
  else void refresh()
}
watch(
  [draftView, () => JSON.stringify(query.value), () => auth.currentUser.value?.id, context],
  () => void loadDrafts(),
  { immediate: true },
)
watch([selectedId, ready, draftView, () => auth.currentUser.value?.id, context], () => void readDetail(), {
  immediate: true,
})
watch(
  [isOwner, () => route.query.edit, ready],
  () => {
    const id = promptId(route.query.edit)
    if (isOwner.value && ready.value && id && !editorOpen.value) openEditor(id)
  },
  { immediate: true },
)
onMounted(() => void auth.restore())
onScopeDispose(() => {
  alive = false
  draftGeneration++
  detailGeneration++
  detailController?.abort()
})
</script>
<style scoped lang="scss">
.prompts-body {
  flex: 1;
  padding: 0;
}
:deep(.prompts-viewport) {
  padding: 1.8rem 2rem 2rem;
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
  padding: 0.25rem 0 2rem;
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
.prompts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1.25rem 0 0.75rem;
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
.prompts-grid {
  columns: 3;
  column-gap: 1.25rem;
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
@media (min-width: 1700px) {
  .prompts-grid {
    columns: 4;
  }
}
@media (max-width: 1050px) {
  .prompts-grid {
    columns: 2;
  }
  .prompts-intro__index {
    min-width: auto;
  }
}
@media (max-width: 640px) {
  :deep(.prompts-viewport) {
    padding: 1rem;
  }
  .prompts-intro {
    padding-bottom: 1.3rem;
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
  .prompts-grid {
    column-gap: 0.75rem;
  }
  .prompts-toolbar {
    gap: 0.75rem;
  }
  .prompts-toolbar :deep(.search-box) {
    width: 100%;
  }
  .prompts-add {
    padding-inline: 0.65rem;
  }
  .prompts-filters {
    gap: 0.4rem;
  }
  .prompts-bottom p {
    line-height: 1.8;
  }
}
@media (max-width: 380px) {
  .prompts-grid {
    columns: 1;
  }
}
</style>
