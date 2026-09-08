<!--
  @file error.vue
  @description Nuxt 全局错误页面，独立渲染，根据状态码展示对应提示
  @author TixXin
  @since 2026-03-23
-->

<template>
  <main class="error-page">
    <div class="error-page__card">
      <CommonStateBlock
        :icon="errorConfig.icon"
        :title="errorConfig.title"
        :description="errorConfig.description"
        :status-code="errorStatus"
        :action-label="errorStatus >= 500 ? '重试当前页面' : '返回首页'"
        @action="handlePrimary"
      >
        <button v-if="errorStatus >= 500" type="button" class="error-page__secondary" @click="handleHome">
          返回首页
        </button>
      </CommonStateBlock>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const errorStatus = computed(() => props.error.statusCode ?? 500)
useHead({ htmlAttrs: { lang: 'zh-CN' } })
useSeoMeta({ robots: 'noindex, follow' })

const errorConfig = computed(() => {
  const code = props.error?.statusCode ?? 500
  const data = props.error.data as { title?: string } | undefined

  if (code === 404) {
    return {
      icon: 'lucide:search-x',
      title: data?.title || '页面未找到',
      description: '你访问的页面不存在或已被移除，请检查链接是否正确',
    }
  }

  if (code >= 500) {
    return {
      icon: 'lucide:server-crash',
      title: data?.title || '服务器错误',
      description: '服务器遇到了问题，请稍后再试',
    }
  }

  return {
    icon: 'lucide:alert-triangle',
    title: '出错了',
    description: props.error?.message || '发生了未知错误',
  }
})

const handleHome = () => clearError({ redirect: '/' })
function handlePrimary() {
  if (errorStatus.value >= 500) window.location.reload()
  else void handleHome()
}
</script>

<style lang="scss" scoped>
.error-page__secondary {
  min-height: 44px;
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
}
</style>
