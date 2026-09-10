<!-- @file links.vue @description 真实友链、推荐筛选与本站资料，URL和SSR首帧保持一致 -->
<template>
  <CommonPageFrame class="main-inner" header-key="links"
    ><template #header
      ><CommonPageHeader title="友情链接" subtitle="互联网上志同道合的伙伴们" icon="lucide:link"
        ><template #action
          ><CommonSearchBox
            v-model="keyword"
            label="搜索友链"
            placeholder="搜索站点、介绍或地址..." /></template></CommonPageHeader></template
    ><template #default
      ><CommonCustomScrollbar class="links-body" viewport-class="links-viewport" :show-back-to-top="false" primary
        ><div class="links-filters">
          <label
            >推荐筛选<select
              :value="query.featured ?? ''"
              aria-label="筛选推荐友链"
              :disabled="!ready"
              @change="changeQuery({ featured: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">全部友链</option>
              <option value="true">推荐友链</option>
              <option value="false">其他友链</option>
            </select></label
          ><button
            v-if="query.q || query.featured"
            type="button"
            :disabled="!ready"
            @click="changeQuery({ q: undefined, featured: undefined })"
          >
            清除筛选
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="links.length > 0"
          :title="error?.message || '正在读取友链'"
          @retry="refresh()"
        />
        <p v-if="stale" role="status" class="links-result">当前筛选尚未完成，以下保留上一次成功读取的友链。</p>
        <p v-else-if="total !== null" role="status" class="links-result">
          共 {{ total }} 条友链 · 第 {{ query.page }} 页
        </p>
        <CommonStateBlock
          v-if="!pending && !error && !links.length"
          icon="lucide:link"
          :title="query.q || query.featured ? '没有找到友链' : '尚无公开友链'"
          :description="query.q || query.featured ? '试试其他名称、介绍或站点地址。' : '友链上架后会展示在这里。'"
          :action-label="query.q || query.featured ? '清除筛选' : undefined"
          @action="changeQuery({ q: undefined, featured: undefined })"
        /><LinkGrid v-else :links="links" />
        <nav v-if="total !== null && (total > 12 || query.page > 1)" class="links-pagination" aria-label="友链分页">
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
        <details class="links-compact-info" :class="`links-compact-info--${sidebarPlacement}`">
          <summary>友链统计、须知与本站资料</summary>
          <CommonRequestFeedback
            v-if="metadataPending || metadataError"
            :pending="metadataPending"
            :compact="!!metadata"
            :title="metadataError?.message || '正在读取友链信息'"
            @retry="refreshMetadata()"
          /><LinkStats v-if="metadata" :stats="metadata.stats" /><LinkRules
            v-if="metadata"
            :rules="metadata.rules"
          /><LinkSiteInfoCard
            :info="site.info.value"
            :ready="site.ready.value"
            :pending="site.pending.value"
            :error="site.error.value"
            :copying="site.copying.value"
            :copy-error="site.copyError.value"
            :notice="site.notice.value"
            :retained-text="site.retainedText.value"
            @retry="site.refresh"
            @copy="site.copy"
          />
        </details>
        <LinkForm
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
        /> </CommonCustomScrollbar></template
    ><template #overlays
      ><ClientOnly
        ><Teleport v-if="activeTheme.capabilities.rightSidebar" to="#right-sidebar-target"
          ><SidebarRightSidebar
            ><CommonRequestFeedback
              v-if="metadataPending || metadataError"
              :pending="metadataPending"
              :compact="!!metadata"
              :title="metadataError?.message || '正在读取友链信息'"
              @retry="refreshMetadata()" /><LinkStats v-if="metadata" :stats="metadata.stats" /><LinkRules
              v-if="metadata"
              :rules="metadata.rules" /><LinkSiteInfoCard
              :info="site.info.value"
              :ready="site.ready.value"
              :pending="site.pending.value"
              :error="site.error.value"
              :copying="site.copying.value"
              :copy-error="site.copyError.value"
              :notice="site.notice.value"
              :retained-text="site.retainedText.value"
              @retry="site.refresh"
              @copy="site.copy" /></SidebarRightSidebar></Teleport></ClientOnly></template
  ></CommonPageFrame>
</template>
<script setup lang="ts">
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
useSeoMeta({ title: '友情链接', description: '浏览博主维护的友情链接与站点资料', ogType: 'website' })
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
.links-filters,
.links-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.links-filters label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
select,
.links-filters button,
.links-pagination button {
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
.links-result {
  margin-bottom: 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.links-pagination {
  justify-content: center;
  margin-top: 1rem;
}
.links-compact-info summary {
  padding-block: 1rem;
  cursor: pointer;
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
