<!--
  @file TableOfContents.vue
  @description 文章右侧目录导航，支持层级缩进与当前章节高亮
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="toc card">
    <div class="toc__header">
      <h3 class="toc__title">
        <Icon name="lucide:list" size="16" />
        文章目录
      </h3>
      <span v-if="progress !== undefined" class="toc__progress">{{ Math.round(progress) }}%</span>
    </div>
    <nav class="toc__nav" aria-label="文章目录">
      <a
        v-for="item in items"
        :key="item.id"
        :href="`#${item.id}`"
        class="toc__link"
        :class="{
          'toc__link--active': item.id === activeId,
          'toc__link--sub': item.level > 2,
        }"
        :style="{ paddingLeft: `${0.75 + (item.level - 2) * 0.75}rem` }"
        @click="handleClick($event, item.id)"
      >
        <span class="toc__dot" :class="{ 'toc__dot--sub': item.level > 2 }" />
        {{ item.text }}
      </a>
    </nav>
  </section>
</template>

<script setup lang="ts">
import type { TocItem } from '~/features/post/types'

defineProps<{
  items: TocItem[]
  activeId: string
  progress?: number
}>()

/**
 * 拦截目录链接的默认跳转行为：
 * - 默认 <a href="#id"> 会让浏览器把每次点击都推入 history，导致文章详情顶栏的"返回上一页"
 *   一直在锚点之间回退，无法真正回到上一个页面（这是一个真实 bug）。
 * - 这里改为：手动 scrollIntoView 滚动到目标，并用 history.replaceState 替换当前 hash，
 *   保证 history 长度不变，外观（地址栏 hash 同步）和右键复制链接行为都保留。
 * - 仅响应纯左键点击；带修饰键 / 中键的点击保留浏览器默认（新标签页等）。
 */
function handleClick(event: MouseEvent, id: string) {
  if (event.defaultPrevented) return
  if (event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  event.preventDefault()
  const target = document.getElementById(id)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // 复用 history.state，避免破坏 Vue Router 的内部状态记录
  if (typeof history !== 'undefined') {
    const nextUrl = location.pathname + location.search + '#' + id
    history.replaceState(history.state, '', nextUrl)
  }
}
</script>

<style lang="scss" scoped>
.toc {
  display: none;
  padding: 1.25rem;
  border-radius: $radius-card;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  transition: $transition-colors;

  @media (min-width: $breakpoint-lg) {
    display: block;
  }
}

.toc__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.toc__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

.toc__progress {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface-2);
  padding: 0.125rem 0.375rem;
  border-radius: $radius-sm;
}

.toc__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toc__link {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: $radius-md;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: $transition-fast;

  &:hover {
    background: var(--surface-3);
    color: var(--text-main);
  }

  &--sub {
    font-size: 0.8125rem;
    color: var(--text-soft);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.toc__dot {
  width: 6px;
  height: 6px;
  border-radius: $radius-full;
  flex-shrink: 0;
  background: var(--text-soft);

  &--sub {
    width: 4px;
    height: 4px;
  }
}
</style>
