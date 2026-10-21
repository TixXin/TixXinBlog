<!--
  @file DevDebugRouteSection.vue
  @description Dev 调试面板路由与主题 Tab 分区（路径信息、参数、剪贴板复制与明暗主题切换）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="dev-debug-section">
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">fullPath</span>
      <span
        class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--clickable"
        @click="copyText(route.fullPath)"
      >
        {{ route.fullPath }}
        <Icon name="lucide:copy" size="11" />
      </span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">name</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">
        {{ String(route.name ?? '—') }}
      </span>
    </div>
    <div v-if="paramsText !== '{}'" class="dev-debug-row">
      <span class="dev-debug-row__label">params</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ paramsText }}</span>
    </div>
    <div v-if="queryText !== '{}'" class="dev-debug-row">
      <span class="dev-debug-row__label">query</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ queryText }}</span>
    </div>

    <div class="dev-debug-divider" />

    <div class="dev-debug-row">
      <span class="dev-debug-row__label">color mode</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip dev-debug-chip--accent">{{ colorMode.value }}</span>
        <span class="dev-debug-row__hint">pref: {{ colorMode.preference }}</span>
      </span>
    </div>
    <div class="dev-debug-actions">
      <button
        v-for="opt in COLOR_MODE_OPTIONS"
        :key="opt.value"
        type="button"
        class="dev-debug-btn"
        :class="{ 'is-active': colorMode.preference === opt.value }"
        @click="colorMode.preference = opt.value"
      >
        <Icon :name="opt.icon" size="13" />
        <span>{{ opt.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { copyTextToClipboard } from '~/features/dev/clipboard'
import { COLOR_MODE_OPTIONS } from '~/features/dev/constants'

const route = useRoute()
const colorMode = useColorMode()
const { success, info } = useToast()

const paramsText = computed(() => JSON.stringify(route.params))
const queryText = computed(() => JSON.stringify(route.query))

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
</style>
