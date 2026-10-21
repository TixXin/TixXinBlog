<!--
  @file DevDebugViewportSection.vue
  @description Dev 调试面板视口 Tab 分区（分辨率、断点、DPR、视口预设与多端窗口预览）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="dev-debug-section">
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">分辨率</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ viewport.w }} × {{ viewport.h }}</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">断点</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip dev-debug-chip--accent">{{ breakpoint }}</span>
        <span class="dev-debug-row__hint">{{ breakpointHint }}</span>
      </span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">DPR</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ dpr }}×</span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">UA 类型</span>
      <span class="dev-debug-row__value">
        <span class="dev-debug-chip" :class="isMobileUA ? 'dev-debug-chip--warn' : 'dev-debug-chip--ok'">
          {{ isMobileUA ? 'mobile' : 'desktop' }}
        </span>
      </span>
    </div>
    <div class="dev-debug-row">
      <span class="dev-debug-row__label">滚动位置</span>
      <span class="dev-debug-row__value dev-debug-row__value--mono">{{ scrollY }}px</span>
    </div>

    <div class="dev-debug-divider" />

    <p class="dev-debug-note">
      网页无法改变当前窗口尺寸：点预设会按该视口尺寸打开当前页面的预览窗口，再点其他尺寸直接调整同一窗口；在预览窗口里点则调整自身。超出屏幕的尺寸会被浏览器截到屏幕大小。
    </p>
    <div class="dev-debug-viewports">
      <button
        v-for="preset in VIEWPORT_PRESETS"
        :key="preset.label"
        type="button"
        class="dev-debug-btn"
        :class="{ 'is-active': viewport.w === preset.w && viewport.h === preset.h }"
        @click="onOpenViewport(preset.w, preset.h)"
      >
        <Icon :name="preset.icon" size="13" />
        <span>{{ preset.label }}</span>
        <span class="dev-debug-viewports__size">{{ preset.w }}×{{ preset.h }}</span>
      </button>
    </div>
    <form class="dev-debug-viewport-custom" @submit.prevent="onOpenViewport(customViewport.w, customViewport.h)">
      <label>
        <span class="sr-only">宽度</span>
        <input v-model.number="customViewport.w" type="number" min="240" max="3840" required />
      </label>
      <span aria-hidden="true">×</span>
      <label>
        <span class="sr-only">高度</span>
        <input v-model.number="customViewport.h" type="number" min="240" max="2160" required />
      </label>
      <button type="submit" class="dev-debug-btn">
        <Icon name="lucide:app-window" size="13" />
        <span>打开</span>
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { useDevViewport } from '~/features/dev/useDevViewport'
import { VIEWPORT_PRESETS, openViewport } from '~/features/dev/viewport'

const { viewport, dpr, isMobileUA, scrollY, breakpoint, breakpointHint } = useDevViewport()
const { info } = useToast()

const customViewport = ref({ w: 1280, h: 800 })

function onOpenViewport(w: number, h: number) {
  openViewport(w, h, () => {
    info('预览窗口被浏览器拦截，请允许本站弹出窗口后重试')
  })
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/dev-debug' as devDebug;

@include devDebug.shared-styles;

.dev-debug-viewports {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.375rem;

  .dev-debug-btn {
    justify-content: flex-start;
  }
}

.dev-debug-viewports__size {
  margin-left: auto;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 500;
}

.dev-debug-viewport-custom {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;

  input {
    width: 5rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: $radius-sm;
    background: var(--surface-2);
    color: var(--text-main);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }
}
</style>
