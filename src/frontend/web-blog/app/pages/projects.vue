<!-- @file projects.vue @description 真实项目列表与技术分布，进展、标签、搜索和分页共享 URL -->
<template>
  <CommonPageFrame class="main-inner" header-key="projects">
    <template #header
      ><CommonPageHeader title="项目展示" subtitle="记录创作、实践与持续维护的项目" icon="lucide:layers"
        ><template #action
          ><CommonSearchBox
            v-model="keyword"
            label="搜索项目"
            placeholder="搜索项目、介绍..." /></template></CommonPageHeader
    ></template>
    <template #default
      ><CommonCustomScrollbar
        class="projects-body"
        viewport-class="projects-viewport"
        :show-back-to-top="false"
        primary
      >
        <section
          v-if="focus.target.value"
          ref="focusedProject"
          class="projects-focus"
          tabindex="-1"
          aria-label="指定项目"
        >
          <header>
            <h2>项目详情</h2>
            <button type="button" @click="focus.close">关闭项目详情</button>
          </header>
          <CommonRequestFeedback
            v-if="focus.pending.value || focus.error.value"
            :pending="focus.pending.value"
            :title="focus.error.value || '正在读取指定项目'"
            @retry="focus.load"
          />
          <ProjectCard v-if="focus.item.value" :project="focus.item.value" :interactive="ready" @tag="filterTag" />
          <CommonRelatedContent :items="focus.item.value?.relatedContent" />
        </section>
        <div class="projects-filters">
          <label
            >项目进展<select
              :value="query.progress ?? ''"
              aria-label="筛选项目进展"
              :disabled="!ready"
              @change="changeQuery({ progress: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">全部进展</option>
              <option v-for="(label, value) in projectProgressLabels" :key="value" :value="value">{{ label }}</option>
            </select></label
          ><label
            >技术标签<select
              :value="query.tag?.toLocaleLowerCase('zh-CN') ?? ''"
              aria-label="筛选项目技术"
              :disabled="!ready"
              @change="changeQuery({ tag: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">全部技术</option>
              <option v-if="query.tag && !knownTag" :value="query.tag.toLocaleLowerCase('zh-CN')">
                {{ query.tag }}
              </option>
              <option
                v-for="tag in metadata?.tags ?? []"
                :key="tag.label"
                :value="tag.label.toLocaleLowerCase('zh-CN')"
              >
                {{ tag.label }}（{{ tag.count }}）
              </option>
            </select></label
          ><button v-if="filtered" type="button" :disabled="!ready" @click="clearFilters">清除筛选</button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="projects.length > 0"
          :title="error?.message || '正在读取项目'"
          @retry="refresh()"
        />
        <p v-if="stale" role="status" class="projects-result">当前筛选尚未完成，以下保留上一次成功读取的项目。</p>
        <p v-else-if="total !== null" role="status" class="projects-result">
          共 {{ total }} 个项目 · 第 {{ query.page }} 页
        </p>
        <CommonStateBlock
          v-if="!pending && !error && !projects.length"
          icon="lucide:layers"
          :title="filtered ? '没有找到项目' : '尚无公开项目'"
          :description="filtered ? '试试其他关键词、进展或技术标签。' : '项目公开后会展示在这里。'"
          :action-label="filtered ? '清除筛选' : undefined"
          @action="clearFilters"
        />
        <ProjectGrid v-else :projects="projects" :interactive="ready" @tag="filterTag" @open="openProject" />
        <nav v-if="total !== null && (total > 12 || query.page > 1)" class="projects-pagination" aria-label="项目分页">
          <button
            type="button"
            :disabled="!ready || pending || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            上一页</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span
          ><button
            type="button"
            :disabled="!ready || pending || query.page * 12 >= total"
            @click="changeQuery({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
        <details class="projects-compact-info" :class="`projects-compact-info--${sidebarPlacement}`">
          <summary>项目统计与技术栈</summary>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataError?.message || '正在读取项目统计'"
            @retry="refreshMetadata()"
          /><ProjectStats v-if="metadata" :stats="stats" /><ProjectTechStackCard
            v-if="metadata"
            :stack="metadata.tags"
            :interactive="ready"
            @tag="filterTag"
          />
        </details> </CommonCustomScrollbar
    ></template>
    <template #overlays
      ><ClientOnly
        ><Teleport v-if="activeTheme.capabilities.rightSidebar" to="#right-sidebar-target"
          ><SidebarRightSidebar
            ><CommonRequestFeedback
              v-if="metadataPending || metadataError"
              :pending="metadataPending"
              :compact="!!metadata"
              :title="metadataError?.message || '正在读取项目统计'"
              @retry="refreshMetadata()" /><ProjectStats v-if="metadata" :stats="stats" /><ProjectTechStackCard
              v-if="metadata"
              :stack="metadata.tags"
              :interactive="ready"
              @tag="filterTag" /></SidebarRightSidebar></Teleport></ClientOnly
    ></template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { projectProgressLabels } from '~/features/project/types'
const focus = useProjectFocus()
const focusedProject = ref<HTMLElement | null>(null)
watch([focus.item, focus.error], async () => {
  if (!focus.target.value || focus.pending.value) return
  await nextTick()
  focusedProject.value?.focus({ preventScroll: true })
  focusedProject.value?.scrollIntoView({ block: 'start' })
})
const route = useRoute(),
  router = useRouter(),
  { currentThemeId, activeTheme } = useLayoutTheme()
const sidebarPlacement = computed(() =>
  activeTheme.value.capabilities.rightSidebar ? currentThemeId.value : 'standalone',
)
const {
  query,
  ready,
  projects,
  total,
  stale,
  pending,
  error,
  refresh,
  metadata,
  metadataPending,
  metadataError,
  refreshMetadata,
  changeQuery,
} = await useProjects()
useSeoMeta({
  title: '项目展示',
  description: '记录个人项目与创作实践，按项目进展和技术标签浏览',
  ogType: 'website',
  ogImage: () => projects.value.find((project) => project.cover)?.cover ?? undefined,
})
const keyword = computed({
  get: () => (!ready.value ? (query.value.q ?? '') : typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => {
    void router.replace({ path: '/projects', query: { ...route.query, q: q || undefined, page: undefined } })
  },
})
const filtered = computed(() => !!query.value.q || !!query.value.progress || !!query.value.tag)
const knownTag = computed(() =>
  metadata.value?.tags.some(
    (tag) => tag.label.toLocaleLowerCase('zh-CN') === query.value.tag?.toLocaleLowerCase('zh-CN'),
  ),
)
const stats = computed(() =>
  metadata.value
    ? [
        { label: '公开项目', value: String(metadata.value.stats.projects) },
        { label: '维护中', value: String(metadata.value.stats.active) },
        { label: '开发中', value: String(metadata.value.stats.dev) },
        { label: '已归档', value: String(metadata.value.stats.archived) },
        { label: '技术标签', value: String(metadata.value.stats.tags) },
      ]
    : [],
)
function filterTag(tag: string) {
  void changeQuery({ tag })
}
function openProject(id: number) {
  void router.push({ path: '/projects', query: { ...route.query, project: String(id) } })
}
function clearFilters() {
  void changeQuery({ q: undefined, tag: undefined, progress: undefined })
}
</script>
<style scoped lang="scss">
.projects-focus {
  margin-bottom: 1.5rem;
  min-width: 0;
}
.projects-focus header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.projects-focus h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
.projects-focus button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
}
.projects-body {
  flex: 1;
  padding: 0;
}
:deep(.projects-viewport) {
  padding: 1.5rem 2rem 2rem;
}
.projects-filters,
.projects-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.projects-filters label {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
select,
button {
  min-height: 44px;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  color: var(--text-main);
}
button:disabled {
  opacity: 0.5;
}
.projects-result {
  color: var(--text-soft);
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}
.projects-pagination {
  justify-content: center;
  margin-top: 1rem;
}
.projects-compact-info summary {
  padding-block: 1rem;
  cursor: pointer;
}
@media (min-width: 1440px) {
  .projects-compact-info--nexus {
    display: none;
  }
}
@media (min-width: 1280px) {
  .projects-compact-info--aurora {
    display: none;
  }
}
@media (max-width: 640px) {
  :deep(.projects-viewport) {
    padding: 1rem;
  }
}
</style>
