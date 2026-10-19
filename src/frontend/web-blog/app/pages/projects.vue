<!-- @file projects.vue @description 真实项目列表与技术分布，进展、标签、搜索和分页共享 URL -->
<template>
  <CommonPageFrame class="main-inner" header-key="projects">
    <template #header
      ><CommonPageHeader
        :title="$t('misc.project.page.title')"
        :subtitle="$t('misc.project.page.subtitle')"
        icon="lucide:layers"
        ><template #action
          ><CommonSearchBox
            v-model="keyword"
            :label="$t('misc.project.page.searchLabel')"
            :placeholder="$t('misc.project.page.searchPlaceholder')" /></template></CommonPageHeader
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
          :aria-label="$t('misc.project.focus.label')"
        >
          <header>
            <h2>{{ $t('misc.project.focus.title') }}</h2>
            <button type="button" @click="focus.close">{{ $t('misc.project.focus.close') }}</button>
          </header>
          <CommonRequestFeedback
            v-if="focus.pending.value || focus.error.value"
            :pending="focus.pending.value"
            :title="focus.error.value || $t('misc.project.focus.loading')"
            @retry="focus.load"
          />
          <ProjectCard v-if="focus.item.value" :project="focus.item.value" :interactive="ready" @tag="filterTag" />
          <CommonRelatedContent :items="focus.item.value?.relatedContent" />
        </section>
        <div class="projects-filters">
          <label
            >{{ $t('misc.project.filter.progress')
            }}<select
              :value="query.progress ?? ''"
              :aria-label="$t('misc.project.filter.progressLabel')"
              :disabled="!ready"
              @change="changeQuery({ progress: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">{{ $t('misc.project.filter.allProgress') }}</option>
              <option v-for="value in projectProgresses" :key="value" :value="value">
                {{ projectProgressLabel(value, t) }}
              </option>
            </select></label
          ><label
            >{{ $t('misc.project.filter.tag')
            }}<select
              :value="query.tag?.toLocaleLowerCase('zh-CN') ?? ''"
              :aria-label="$t('misc.project.filter.tagLabel')"
              :disabled="!ready"
              @change="changeQuery({ tag: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">{{ $t('misc.project.filter.allTags') }}</option>
              <option v-if="query.tag && !knownTag" :value="query.tag.toLocaleLowerCase('zh-CN')">
                {{ query.tag }}
              </option>
              <option
                v-for="tag in metadata?.tags ?? []"
                :key="tag.label"
                :value="tag.label.toLocaleLowerCase('zh-CN')"
              >
                {{ $t('misc.project.filter.tagOption', { label: tag.label, count: tag.count }) }}
              </option>
            </select></label
          ><button v-if="filtered" type="button" :disabled="!ready" @click="clearFilters">
            {{ $t('misc.project.page.clearFilters') }}
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="projects.length > 0"
          :title="error?.message || $t('misc.project.page.loading')"
          @retry="refresh()"
        />
        <p v-if="stale" role="status" class="projects-result">
          {{ $t('misc.project.page.stale') }}
        </p>
        <p v-else-if="total" role="status" class="projects-result">
          {{ $t('misc.project.page.summary', { count: total, page: query.page }, total) }}
        </p>
        <CommonStateBlock
          v-if="!pending && !error && !projects.length"
          icon="lucide:layers"
          :title="filtered ? $t('misc.project.empty.filteredTitle') : $t('misc.project.empty.title')"
          :description="filtered ? $t('misc.project.empty.filteredDescription') : $t('misc.project.empty.description')"
          :action-label="filtered ? $t('misc.project.page.clearFilters') : undefined"
          @action="clearFilters"
        />
        <ProjectGrid v-else :projects="projects" :interactive="ready" @tag="filterTag" @open="openProject" />
        <nav
          v-if="total !== null && (total > 12 || query.page > 1)"
          class="projects-pagination"
          :aria-label="$t('misc.project.page.pagination')"
        >
          <button
            type="button"
            :disabled="!ready || pending || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            {{ $t('misc.shared.prevPage') }}</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / 12)) }}</span
          ><button
            type="button"
            :disabled="!ready || pending || query.page * 12 >= total"
            @click="changeQuery({ page: query.page + 1 })"
          >
            {{ $t('misc.shared.nextPage') }}
          </button>
        </nav>
        <details class="projects-compact-info" :class="`projects-compact-info--${sidebarPlacement}`">
          <summary>{{ $t('misc.project.page.compactInfo') }}</summary>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataFeedbackTitle"
            :description="metadataFeedbackDescription"
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
              :title="metadataFeedbackTitle"
              :description="metadataFeedbackDescription"
              @retry="refreshMetadata()" /><ProjectStats v-if="metadata" :stats="stats" /><ProjectTechStackCard
              v-if="metadata"
              :stack="metadata.tags"
              :interactive="ready"
              @tag="filterTag" /></SidebarRightSidebar></Teleport></ClientOnly
    ></template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { projectProgressLabel, projectProgresses } from '~/features/project/types'
const { t } = useI18n()
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
// 失败用稳定标题；具体原因放在说明里，有旧统计时同时说明仍在显示。
const metadataFeedbackTitle = computed(() =>
  metadataError.value ? t('misc.project.metadata.unavailable') : t('misc.project.metadata.loading'),
)
const metadataFeedbackDescription = computed(() => {
  if (!metadataError.value) return undefined
  const message = metadataError.value.message
  return metadata.value ? t('misc.project.metadata.staleDescription', { message }) : message
})
const shareProject = computed(() => projects.value.find((project) => project.cover))
usePageSeo({
  title: () => t('misc.project.page.title'),
  description: () => t('misc.project.page.seoDescription'),
  type: 'website',
  image: () => shareProject.value?.cover,
  imageAlt: () => shareProject.value?.title,
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
        { label: t('misc.project.stats.projects'), value: String(metadata.value.stats.projects) },
        { label: t('misc.project.stats.active'), value: String(metadata.value.stats.active) },
        { label: t('misc.project.stats.dev'), value: String(metadata.value.stats.dev) },
        { label: t('misc.project.stats.archived'), value: String(metadata.value.stats.archived) },
        { label: t('misc.project.stats.tags'), value: String(metadata.value.stats.tags) },
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
// 清除筛选按钮与下拉框底边对齐，而不是居中于“标签 + 下拉框”整体
.projects-filters {
  align-items: flex-end;
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
  font-size: 0.875rem;
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
  cursor: var(--interaction-cursor, pointer);
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
