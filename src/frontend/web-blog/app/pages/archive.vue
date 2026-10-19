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
            <h1 class="page-title__heading">{{ $t('article.archive.title') }}</h1>
            <p class="page-title__sub">
              {{
                displayed
                  ? $t(
                      'article.archive.summary',
                      { period: postArchivePeriod(displayedQuery ?? query, t), count: displayed.total },
                      displayed.total,
                    )
                  : archivePending
                    ? $t('article.archive.loading')
                    : $t('article.archive.unavailable')
              }}
            </p>
          </div>
        </div>

        <!-- 原生年月筛选支持键盘和读屏，窄屏操作区自动换行。 -->
        <div class="page-actions">
          <label class="archive-year-filter">
            <span class="archive-year-filter__label">{{ $t('article.archive.yearLabel') }}</span>
            <select
              :aria-label="$t('article.archive.yearSelect')"
              :value="query.year ?? ''"
              :disabled="!ready"
              @change="selectYear"
            >
              <option value="">{{ $t('article.archive.allYears') }}</option>
              <option v-for="year in years" :key="year.year" :value="year.year">
                {{ $t('article.archive.yearOption', { year: year.year, count: year.count }, year.count) }}
              </option>
              <option v-if="query.year && !years.some((item) => item.year === query.year)" :value="query.year">
                {{
                  current
                    ? $t('article.archive.yearOption', { year: query.year, count: 0 }, 0)
                    : $t('article.archive.year', { year: query.year })
                }}
              </option>
            </select>
          </label>
          <label class="archive-year-filter">
            <span class="archive-year-filter__label">{{ $t('article.archive.monthLabel') }}</span>
            <select
              :aria-label="$t('article.archive.monthSelect')"
              :value="query.month ?? ''"
              :disabled="!ready || !query.year"
              @change="selectMonth"
            >
              <option value="">
                {{ query.year ? $t('article.archive.allMonths') : $t('article.archive.selectYearFirst') }}
              </option>
              <option v-for="month in 12" :key="month" :value="month">{{ monthLabel(month) }}</option>
            </select>
          </label>
          <CommonSearchBox :placeholder="$t('article.archive.searchPlaceholder')" readonly @click="openSearch" />
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
          :title="$t('article.archive.loadFailed')"
          :description="displayed ? $t('article.archive.keptPrevious') : $t('article.archive.loadFailedDescription')"
          @retry="refreshArchive()"
        />
        <p v-if="stale && displayedQuery" class="archive-stale-notice" role="status">
          {{
            $t('article.archive.staleNotice', {
              period: postArchivePeriod(displayedQuery, t),
              page: displayedQuery.page,
            })
          }}
        </p>
        <ArticleArchiveTimeline v-if="archiveYears.length" :years="archiveYears" />
        <CommonStateBlock
          v-else-if="!archivePending && !archiveError"
          icon="lucide:archive"
          :title="$t('article.archive.emptyTitle')"
          :description="$t('article.archive.emptyDescription')"
        />
        <nav
          v-if="displayed && displayedPageCount > 1"
          class="archive-pagination"
          :aria-label="$t('article.archive.paginationLabel')"
        >
          <button
            type="button"
            :disabled="!ready || archivePending || !current || query.page <= 1"
            @click="changeQuery({ page: query.page - 1 })"
          >
            {{ $t('article.pagination.previous') }}
          </button>
          <span aria-live="polite">{{ displayed.page }} / {{ displayedPageCount }}</span>
          <button
            type="button"
            :disabled="!ready || archivePending || !current || query.page >= pageCount"
            @click="changeQuery({ page: query.page + 1 })"
          >
            {{ $t('article.pagination.next') }}
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
            :title="$t('article.archive.statsUnavailable')"
            :description="metadata ? $t('article.archive.statsKept') : undefined"
            @retry="refreshMetadata()"
          />
        </SidebarRightSidebar>
      </Teleport>
    </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { postArchivePeriod, postArchiveSeo } from '~/features/post/archive'

const { t } = useI18n()
/** 月份下拉：中文「3 月」，英文显示月份名称 */
function monthLabel(month: number) {
  const monthName = formatDate(new Date(Date.UTC(2000, month - 1, 15)), { month: 'long', timeZone: 'UTC' })
  return t('article.archive.monthOption', { month, monthName })
}

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

const seo = computed(() => postArchiveSeo(query.value, t))
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
