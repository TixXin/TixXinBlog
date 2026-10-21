<!--
  @file DevDebugPreviewSection.vue
  @description Dev 调试面板界面预览 Tab 分区（未初始化/setup表单等站态模拟与退出）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="dev-debug-section">
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">当前预览</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip" :class="activePreview ? 'dev-debug-chip--warn' : 'dev-debug-chip--muted'">
          {{ activePreview || '无' }}
        </span>
      </span>
    </div>
    <p class="dev-debug-note">只改变前端显示：提交照常校验，但不请求接口、不创建账号。</p>
    <div v-for="group in PREVIEW_GROUPS" :key="group.label" class="dev-debug-group">
      <p class="dev-debug-group__title">{{ group.label }}</p>
      <div class="dev-debug-actions dev-debug-actions--column">
        <button
          v-for="item in group.items"
          :key="item.label"
          type="button"
          class="dev-debug-btn"
          :class="{ 'is-active': isPreviewActive(route.path, route.query, item) }"
          @click="openPreview(item)"
        >
          <Icon :name="item.icon" size="13" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
    <div class="dev-debug-actions">
      <button type="button" class="dev-debug-btn" :disabled="!activePreview" @click="exitPreview">
        <Icon name="lucide:eye-off" size="13" />
        <span>退出预览</span>
      </button>
    </div>

    <div class="dev-debug-divider" />

    <p class="dev-debug-note">真实走完初始化（空库、自动登录）时，在终端启动初始化沙盒：</p>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">沙盒</span>
      <span
        class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--clickable"
        @click="copyText('corepack pnpm dev:setup')"
      >
        corepack pnpm dev:setup
        <Icon name="lucide:copy" size="11" />
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PreviewEntry } from '~/features/dev/types'
import { copyTextToClipboard } from '~/features/dev/clipboard'
import {
  PREVIEW_GROUPS,
  formatActivePreview,
  isPreviewActive,
  createPreviewNavigation,
  createExitPreviewNavigation,
} from '~/features/dev/preview'

const route = useRoute()
const { success, info } = useToast()

const activePreview = computed(() => formatActivePreview(route.query))

async function openPreview(item: PreviewEntry) {
  const target = createPreviewNavigation(route.path, route.query, item)
  await navigateTo(target)
}

async function exitPreview() {
  const target = createExitPreviewNavigation(route.path, route.query, route.hash)
  await navigateTo(target)
}

async function copyText(text: string) {
  await copyTextToClipboard(text, {
    onSuccess: () => success('已复制到剪贴板'),
    onError: () => info('复制失败：浏览器拒绝了剪贴板访问'),
  })
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/dev-debug' as devDebug;

@include devDebug.shared-styles;

.dev-debug-group {
  margin-bottom: 0.75rem;
}

.dev-debug-group__title {
  margin: 0 0 0.375rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
