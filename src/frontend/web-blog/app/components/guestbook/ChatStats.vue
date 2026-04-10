<!--
  @file ChatStats.vue
  @description 留言板右侧栏对话统计卡片，数字首次出现时有 count-up 动效
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section ref="containerRef" class="card chat-stats">
    <h3 class="chat-stats__title">
      <Icon
        name="lucide:bar-chart-2"
        size="14"
      />
      对话统计
    </h3>
    <div class="chat-stats__grid">
      <div
        v-for="(item, index) in stats"
        :key="item.label"
        class="chat-stats__cell"
      >
        <p class="chat-stats__value">
          {{ animatedValues[index] ?? item.value }}
        </p>
        <p class="chat-stats__label">
          {{ item.label }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ChatStat } from '~/features/guestbook/types'

const props = defineProps<{
  stats: ChatStat[]
}>()

const containerRef = ref<HTMLElement | null>(null)
const animatedValues = ref<string[]>(props.stats.map(() => '0'))
const hasAnimated = ref(false)

/** 从字符串中提取数字部分（如 "1,234" → 1234） */
function parseStatValue(val: string): number {
  return parseInt(val.replace(/,/g, ''), 10) || 0
}

/** 格式化数字为千分位 */
function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN')
}

/** 数字递增动画 */
function animateCountUp() {
  if (hasAnimated.value) return
  hasAnimated.value = true

  props.stats.forEach((stat, index) => {
    const target = parseStatValue(stat.value)
    const duration = 800
    const startTime = performance.now()

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - (1 - progress) ** 3
      const current = Math.round(target * eased)
      animatedValues.value[index] = formatNumber(current)
      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        // 最终确保显示原始值（保持格式一致）
        animatedValues.value[index] = stat.value
      }
    }

    requestAnimationFrame(step)
  })
}

onMounted(() => {
  if (!containerRef.value) return
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        animateCountUp()
        observer.disconnect()
      }
    },
    { threshold: 0.3 },
  )
  observer.observe(containerRef.value)

  onBeforeUnmount(() => observer.disconnect())
})
</script>

<style lang="scss" scoped>
.chat-stats {
  padding: 1.25rem;
}

.chat-stats__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);

  :deep(svg),
  :deep(.icon) {
    color: var(--text-soft);
  }
}

.chat-stats__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.chat-stats__cell {
  text-align: center;
  padding: 0.75rem 0.25rem;
  border-radius: $radius-md;
  background: var(--surface-2);
  transition: color 0.2s;

  &:hover .chat-stats__value {
    color: #059669;
  }
}

:root.dark .chat-stats__cell:hover .chat-stats__value {
  color: #34d399;
}

.chat-stats__value {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-main);
  transition: color 0.2s;
  font-variant-numeric: tabular-nums;
}

.chat-stats__label {
  margin: 0.25rem 0 0;
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--text-muted);
}
</style>
