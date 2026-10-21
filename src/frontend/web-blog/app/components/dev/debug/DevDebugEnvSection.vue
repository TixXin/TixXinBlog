<!--
  @file DevDebugEnvSection.vue
  @description Dev 调试面板运行环境 Tab 分区（渲染模式、语言、Mock状态、API地址与构建信息）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="dev-debug-section">
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">mode</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip dev-debug-chip--accent">dev</span>
      </span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">render</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ renderMode }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">界面语言</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ locale }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">数据源</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip" :class="usesMock ? 'dev-debug-chip--warn' : 'dev-debug-chip--ok'">
          {{ usesMock ? '含 Mock' : '真实 API' }}
        </span>
      </span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">API</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ apiBaseUrl }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">Nuxt</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">v{{ nuxtVersion }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">build</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ buildTime }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">UA</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono dev-debug-row__value--wrap">
        {{ userAgent }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const runtimeConfig = useRuntimeConfig()

const publicConfig = runtimeConfig.public as {
  apiBaseUrl?: string
  useMockRepo?: boolean
  postUseMockRepo?: boolean
  nuxtVersion?: string
  buildTime?: string
}

const apiBaseUrl = publicConfig.apiBaseUrl ?? '—'
const usesMock = publicConfig.useMockRepo === true || publicConfig.postUseMockRepo === true
const nuxtVersion = publicConfig.nuxtVersion ?? '—'
const buildTime = publicConfig.buildTime ?? '—'

const renderMode = ref<'client' | 'server'>('server')
const userAgent = ref('—')

onMounted(() => {
  renderMode.value = 'client'
  userAgent.value = navigator.userAgent
})
</script>

<style lang="scss" scoped>
@use '~/assets/styles/dev-debug' as devDebug;

@include devDebug.shared-styles;
</style>
