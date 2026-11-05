<!-- @file links.vue @description 真实友链、推荐筛选与本站资料，URL和SSR首帧保持一致 -->
<template>
  <CommonPageFrame class="main-inner" header-key="links">
    <template #header>
      <CommonPageHeader
        :title="t('interaction.links.title')"
        :subtitle="t('interaction.links.subtitle')"
        icon="lucide:link"
      >
        <template #action>
          <div class="links-actions">
            <CommonSearchBox
              v-model="keyword"
              :label="t('interaction.links.searchLabel')"
              :placeholder="t('interaction.links.searchPlaceholder')"
            />
            <button type="button" class="links-apply-entry btn-primary" @click="scrollToApply">
              <Icon name="lucide:send" size="15" aria-hidden="true" />
              {{ t('interaction.links.applyEntry') }}
            </button>
          </div>
        </template>
      </CommonPageHeader>
    </template>
    <template #default>
      <CommonCustomScrollbar class="links-body" viewport-class="links-viewport" :show-back-to-top="false" primary>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="links.length > 0"
          :title="error?.message || t('interaction.links.loading')"
          @retry="refresh()"
        />
        <LinkToolbar
          :featured="query.featured"
          :page="query.page"
          :total="total"
          :stale="stale"
          :ready="ready"
          :filtered="!!(query.q || query.featured)"
          @change="changeQuery"
        />
        <CommonStateBlock
          v-if="!pending && !error && !links.length"
          icon="lucide:link"
          :title="query.q || query.featured ? t('interaction.links.notFoundTitle') : t('interaction.links.emptyTitle')"
          :description="
            query.q || query.featured ? t('interaction.links.notFoundDesc') : t('interaction.links.emptyDesc')
          "
          :action-label="query.q || query.featured ? t('interaction.links.clearFilters') : undefined"
          @action="changeQuery({ q: undefined, featured: undefined })"
        />
        <LinkGrid v-else :links="links" />
        <LinkPagination
          v-if="total !== null && (total > 12 || query.page > 1)"
          :page="query.page"
          :total="total"
          :disabled="!ready || pending"
          @change="(page) => changeQuery({ page })"
        />
        <details class="links-compact-info" :class="`links-compact-info--${sidebarPlacement}`">
          <summary>
            <Icon name="lucide:chevron-right" size="16" class="links-compact-info__chevron" aria-hidden="true" />
            {{ t('interaction.links.compactInfo') }}
          </summary>
          <LinkSidebarContent
            :metadata="metadata"
            :pending="metadataPending"
            :error="metadataError"
            :site="site"
            @retry-metadata="refreshMetadata()"
          />
        </details>
        <!-- 页头「申请友链」滚动到这里；申请关闭时是整理资料表单 -->
        <div id="link-apply" ref="applyRef" class="links-apply" tabindex="-1">
          <LinkApplicationForm v-if="metadata?.applicationsEnabled && !useStaticSite()" />
          <LinkForm
            v-else
            :value="local.draft.value"
            :ready="local.ready.value"
            :valid="local.valid.value"
            :copying="local.copying.value"
            :error="local.error.value"
            :notice="local.notice.value"
            :storage-error="local.storageError.value"
            @change="local.change"
            @copy="local.copy"
            @persist="local.persist"
          />
        </div>
      </CommonCustomScrollbar>
    </template>
    <template #overlays>
      <!-- 右栏能力判断收敛到组件内部，页面只保留 sidebarPlacement 这类展示逻辑 -->
      <CommonThemeSidebarPortal>
        <SidebarRightSidebar>
          <LinkSidebarContent
            :metadata="metadata"
            :pending="metadataPending"
            :error="metadataError"
            :site="site"
            @retry-metadata="refreshMetadata()"
          />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
    </template>
  </CommonPageFrame>
</template>
<script setup lang="ts">
const { t } = useI18n()
const route = useRoute(),
  router = useRouter(),
  { currentThemeId, activeTheme } = useLayoutTheme()
const sidebarPlacement = computed(() =>
  activeTheme.value.capabilities.rightSidebar ? currentThemeId.value : 'standalone',
)
const site = useLinkSiteInfo(),
  local = useLocalLinkDraft()
const {
  query,
  ready,
  links,
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
} = await useLinks()
usePageSeo({
  title: () => t('interaction.links.title'),
  description: () => t('interaction.links.seoDescription'),
  type: 'website',
})
// 申请区在列表与分页之后，从页头直接跳过去并把焦点交给它，读屏用户同样能到达
const applyRef = ref<HTMLElement | null>(null)
function scrollToApply() {
  const target = applyRef.value
  if (!target) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
}
const keyword = computed({
  get: () => (!ready.value ? (query.value.q ?? '') : typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => {
    void router.replace({ path: '/links', query: { ...route.query, q: q || undefined, page: undefined } })
  },
})
</script>
<style scoped lang="scss">
.links-body {
  flex: 1;
  padding: 0;
}
:deep(.links-viewport) {
  padding: 1.5rem 2rem 2rem;
}
.links-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.links-apply-entry {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 0.875rem;
  border-radius: $radius-full;
  font-size: 0.8125rem;
  white-space: nowrap;
  cursor: var(--interaction-cursor, pointer);
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
.links-apply {
  margin-top: 1.5rem;
  scroll-margin-top: 1rem;
  &:focus {
    outline: none;
  }
}
.links-compact-info summary {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 44px;
  padding-block: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
  list-style: none;
  cursor: var(--interaction-cursor, pointer);

  // 用 Lucide 箭头替换浏览器默认三角标记
  &::-webkit-details-marker {
    display: none;
  }
}
.links-compact-info__chevron {
  flex-shrink: 0;
  color: var(--text-soft);
  transition: transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.links-compact-info[open] .links-compact-info__chevron {
  transform: rotate(90deg);
}
.links-compact-info[open] > :not(summary) + :not(summary) {
  margin-top: 0.75rem;
}
@media (min-width: 1440px) {
  .links-compact-info--nexus {
    display: none;
  }
}
@media (min-width: 1280px) {
  .links-compact-info--aurora {
    display: none;
  }
}
@media (max-width: 640px) {
  :deep(.links-viewport) {
    padding: 1rem;
  }
}
</style>
