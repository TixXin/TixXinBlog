<!--
  @file archive.vue
  @description 文章归档按年月筛选与分页展示，可分享地址与 SSR 元信息同步，统计使用轻量公开数据源
  @author TixXin
  @since 2026-04-11
-->

<template>
  <CommonPageFrame class="main-inner archive-page" header-key="archive">
    <template #header>
      <div class="main-content__header">
        <div class="page-title">
          <div class="page-title__icon-wrap" aria-hidden="true">
            <Icon name="lucide:archive" size="18" />
          </div>
          <div class="page-title__text">
            <h1 class="page-title__heading">文章归档</h1>
            <p class="page-title__sub">
              {{
                displayed
                  ? `${postArchivePeriod(displayedQuery ?? query)} · 共 ${displayed.total} 篇文章`
                  : archivePending
                    ? '正在加载归档…'
                    : '归档暂时不可用'
              }}
            </p>
          </div>
        </div>

        <!-- 原生年月筛选支持键盘和读屏，窄屏操作区自动换行。 -->
        <div class="page-actions">
          <label class="archive-year-filter">
            <span class="archive-year-filter__label">年份</span>
            <select aria-label="归档年份" :value="query.year ?? ''" :disabled="!ready" @change="selectYear">
              <option value="">全部年份</option>
              <option v-for="year in years" :key="year.year" :value="year.year">
                {{ year.year }} 年（{{ year.count }} 篇）
              </option>
              <option v-if="query.year && !years.some((item) => item.year === query.year)" :value="query.year">
                {{ query.year }} 年{{ current ? '（0 篇）' : '' }}
              </option>
            </select>
          </label>
          <label class="archive-year-filter">
            <span class="archive-year-filter__label">月份</span>
            <select
              aria-label="归档月份"
              :value="query.month ?? ''"
              :disabled="!ready || !query.year"
              @change="selectMonth"
            >
              <option value="">{{ query.year ? '全部月份' : '请先选择年份' }}</option>
              <option v-for="month in 12" :key="month" :value="month">{{ month }} 月</option>
            </select>
          </label>
          <CommonSearchBox placeholder="搜索文章标题、内容..." readonly @click="openSearch" />
        </div>
      </div>
    </template>
    <template #default>
      <!-- 头部区域 -->
      <!-- 主内容：归档时间线 -->
      <CommonCustomScrollbar class="archive-body" viewport-class="archive-viewport" :show-back-to-top="false" primary>
        <CommonRequestFeedback
          v-if="archivePending || archiveError"
          :pending="archivePending"
          :compact="!!displayed"
          title="归档加载失败，请稍后重试"
          :description="displayed ? '仍保留上次成功加载的归档，可重试当前筛选。' : '暂时无法获取归档内容。'"
          @retry="refreshArchive()"
        />
        <p v-if="stale && displayedQuery" class="archive-stale-notice" role="status">
          当前显示：{{ postArchivePeriod(displayedQuery) }}，第 {{ displayedQuery.page }} 页（上次成功结果）。
        </p>
        <ArticleArchiveTimeline v-if="archiveYears.length" :years="archiveYears" />
        <CommonStateBlock
          v-else-if="!archivePending && !archiveError"
          icon="lucide:archive"
          title="暂无文章归档"
          description="文章发布后会显示在这里。"
        />
        <nav v-if="displayed && displayedPageCount > 1" class="archive-pagination" aria-label="文章归档分页">
          <button
            type="button"
            :disabled="!ready || archivePending || !current || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            上一页
          </button>
          <span aria-live="polite">{{ displayed.page }} / {{ displayedPageCount }}</span>
          <button
            type="button"
            :disabled="!ready || archivePending || !current || query.page >= pageCount"
            @click="changeQuery({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
      </CommonCustomScrollbar>
      <!-- 右侧栏：归档统计 + 分类分布 -->
    </template>
    <template #overlays>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <ArticleArchiveStats v-if="metadata" :stats="archiveStats" :distribution="categoryDistribution" />
          <CommonRequestFeedback
            v-if="metadataError || !metadata"
            class="card"
            compact
            :pending="metadataPending"
            title="归档统计暂时不可用"
            :description="metadata ? '仍显示上次成功读取的归档统计。' : undefined"
            @retry="refreshMetadata()"
          />
        </SidebarRightSidebar>
      </Teleport>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { postArchivePeriod, postArchiveSeo } from '~/features/post/archive'

const [summary, archive] = await Promise.all([usePostMetadata(), usePostArchive()])
const {
  metadata,
  archiveStats,
  categoryDistribution,
  pending: metadataPending,
  error: metadataError,
  refresh: refreshMetadata,
} = summary
const {
  query,
  ready,
  current,
  displayed,
  displayedQuery,
  stale,
  years,
  archiveYears,
  pageCount,
  changeQuery,
  error: archiveError,
  pending: archivePending,
  refresh: refreshArchive,
} = archive
const displayedPageCount = computed(() =>
  Math.max(1, Math.ceil((displayed.value?.total ?? 0) / (displayed.value?.pageSize ?? 50))),
)
function selectYear(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  void changeQuery({ year: value ? Number(value) : undefined, page: 1 })
}
function selectMonth(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  void changeQuery({ month: value ? Number(value) : undefined })
}

const seo = computed(() => postArchiveSeo(query.value))
usePageSeo({
  title: () => seo.value.title,
  description: () => seo.value.description,
  canonical: () => seo.value.canonical,
  type: 'website',
})

const searchModal = inject<{ open: () => void } | null>('searchModal', null)
function openSearch() {
  searchModal?.open()
}
</script>

<style lang="scss" scoped>
/* 归档时间线滚动区 */
.archive-body {
  flex: 1;
  padding: 0;
}

:deep(.archive-viewport) {
  padding: 1.5rem 2rem 2rem;
}
.archive-year-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.archive-year-filter__label {
  flex-shrink: 0;

  @media (max-width: #{$breakpoint-sm - 1px}) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
}
.archive-stale-notice {
  margin: 0 0 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.6;
}
.archive-year-filter select,
.archive-pagination button {
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-1);
  color: var(--text-main);
}
.archive-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.archive-pagination button:disabled,
.archive-year-filter select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
