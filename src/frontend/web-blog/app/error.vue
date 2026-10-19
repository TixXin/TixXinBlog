<!--
  @file error.vue
  @description Nuxt 全局错误页面，独立渲染，根据状态码展示对应提示
  @author TixXin
  @since 2026-03-23
-->

<template>
  <main class="error-page">
    <div class="error-page__card" :class="{ 'error-page__card--discovery': errorStatus === 404 }">
      <CommonStateBlock
        :icon="errorConfig.icon"
        :title="errorConfig.title"
        :level="1"
        :description="errorConfig.description"
        :status-code="errorStatus"
        :action-label="errorStatus >= 500 ? $t('layout.error.retry') : $t('layout.error.home')"
        :action-href="errorStatus >= 500 ? undefined : '/'"
        @action="handlePrimary"
      >
        <!-- 返回首页是链接：水合前或脚本失效时原生跳转，水合后清除错误再导航 -->
        <a v-if="errorStatus >= 500" href="/" class="error-page__secondary" @click="onHomeLinkClick">
          {{ $t('layout.error.home') }}
        </a>
      </CommonStateBlock>
      <div v-if="errorStatus === 404" class="error-page__discovery">
        <form
          class="error-page__search"
          role="search"
          :aria-label="$t('layout.error.searchLabel')"
          @submit.prevent="handleSearch"
        >
          <CommonSearchBox
            v-model="keyword"
            :label="$t('layout.error.searchKeyword')"
            :placeholder="$t('layout.error.searchPlaceholder')"
          />
          <button type="submit" class="error-page__search-submit">{{ $t('layout.error.searchSubmit') }}</button>
        </form>
        <p v-if="recentError" class="error-page__notice" role="status">
          {{ $t('layout.error.recentFailed') }}
        </p>
        <p v-else-if="recentStatus === 'idle' || recentPending" class="error-page__notice" role="status">
          {{ $t('layout.error.recentLoading') }}
        </p>
        <BlogRecentPosts v-else-if="recentPosts.length" :posts="recentPosts" />
        <p v-else class="error-page__notice" role="status">{{ $t('layout.error.recentEmpty') }}</p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'
import { fetchPostPage } from '~/features/post/api'
import { searchLocation } from '~/features/search/query'

const props = defineProps<{ error: NuxtError }>()
const { t, locale } = useI18n()
const errorStatus = computed(() => props.error.statusCode ?? 500)
const errorConfig = computed(() => {
  const code = props.error?.statusCode ?? 500
  const data = props.error.data as { title?: string } | undefined

  if (code === 404) {
    return {
      icon: 'lucide:search-x',
      title: data?.title || t('layout.error.notFoundTitle'),
      description: t('layout.error.notFoundDescription'),
    }
  }

  if (code >= 500) {
    return {
      icon: 'lucide:server-crash',
      title: data?.title || t('layout.error.serverTitle'),
      description: t('layout.error.serverDescription'),
    }
  }

  return {
    icon: 'lucide:alert-triangle',
    title: t('layout.error.genericTitle'),
    description: props.error?.message || t('layout.error.genericDescription'),
  }
})

// 错误页不经过 app.vue，站名与标题模板需在此按站点设置重新声明，避免落回构建期兜底站名
const { settings: siteSettings } = useSiteSettings()
useHead({
  // 错误页没有语言切换入口，每次出错都会重新挂载，取挂载时的界面语言即可。
  htmlAttrs: { lang: locale.value },
  titleTemplate: (title) => (title ? `${title} - ${siteSettings.value.name}` : siteSettings.value.name),
  title: () => errorConfig.value.title,
})
useSeoMeta({
  robots: 'noindex, follow',
  ogSiteName: () => siteSettings.value.name,
  ogTitle: () => errorConfig.value.title,
})

const router = useRouter()
const keyword = ref('')
const config = useRuntimeConfig()
const recentQuery = { page: 1, pageSize: 5, pinnedFirst: false }
const {
  data: recentPage,
  error: recentError,
  pending: recentPending,
  status: recentStatus,
  execute: loadRecentPosts,
} = usePublicReadData(
  'error-recent-posts',
  (_app, { signal }) => fetchPostPage(config.public.apiBaseUrl, recentQuery, signal),
  {
    domain: 'posts',
    query: () => recentQuery,
    immediate: false,
  },
)
const recentPosts = computed(() => recentPage.value?.items.slice(0, 5) ?? [])
// 推荐内容只在 404 挂载后读取，慢请求与读取失败都不阻塞错误页及其恢复入口。
onMounted(() => {
  if (errorStatus.value === 404) void loadRecentPosts()
})

function handleSearch() {
  if (!keyword.value.trim()) return
  return clearError({ redirect: router.resolve(searchLocation(keyword.value)).fullPath })
}

const handleHome = () => clearError({ redirect: '/' })
/** 普通左键点击走 clearError；带修饰键时保留浏览器默认行为 */
function onHomeLinkClick(event: MouseEvent) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void handleHome()
}
function handlePrimary() {
  if (errorStatus.value >= 500) window.location.reload()
  else void handleHome()
}
</script>

<style lang="scss" scoped>
.error-page__secondary {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  text-decoration: none;
  color: var(--accent-text);
  padding: 0.5rem 0.75rem;
}
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 2rem;
  background: var(--bg);
  background-image: radial-gradient(var(--bg-dot) 1px, transparent 1px);
  background-size: var(--bg-dot-size) var(--bg-dot-size);
}

.error-page__card {
  width: 100%;
  max-width: 28rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-card);
  padding: 2rem 1.5rem;

  &--discovery {
    max-width: 40rem;
  }
}

.error-page__search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  .search-box {
    flex: 1;
    min-width: 0;
    max-width: none;
  }
}

.error-page__search-submit {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-main);

  &:hover {
    background: var(--accent-soft);
  }
}

.error-page__discovery {
  :deep(.recent-posts) {
    margin-bottom: 0;
  }

  :deep(.recent-posts__header) {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  :deep(.recent-posts__more) {
    min-height: 44px;
    align-items: center;
  }

  :deep(a:focus-visible),
  button:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 3px;
  }
}

.error-page__notice {
  color: var(--text-muted);
  line-height: 1.6;
}

@media (max-width: #{$breakpoint-sm - 1px}) {
  .error-page {
    padding: 1rem;
  }

  .error-page__card {
    padding: 1.5rem 1rem;

    :deep(.state-block) {
      padding: 1.5rem 0.5rem;
    }

    :deep(.recent-posts) {
      padding: 1rem;
    }

    :deep(.recent-post-item__cover) {
      width: 64px;
      height: 48px;
    }

    :deep(.recent-post-item__meta) {
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
    }
  }
}
</style>
