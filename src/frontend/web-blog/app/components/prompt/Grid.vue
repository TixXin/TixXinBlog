<!-- @file Grid.vue @description 保留接口与键盘顺序的最短列瀑布流，服务端与无脚本状态使用普通网格 -->
<template>
  <div class="prompts-grid">
    <div ref="grid" class="prompt-grid__layout" @load.capture="schedule" @error.capture="schedule">
      <div v-for="item in items" :key="item.id" class="prompt-grid__item">
        <PromptCard
          :item="item"
          :ready="ready"
          :editable="editable"
          :status="draft ? 'draft' : 'published'"
          @open="$emit('open', $event)"
          @edit="$emit('edit', $event)"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { ImagePrompt } from '~/features/prompt/types'
import { promptGridLayout } from '~/features/prompt/layout'
const props = defineProps<{ items: ImagePrompt[]; ready: boolean; editable?: boolean; draft?: boolean }>()
defineEmits<{ open: [id: number]; edit: [id: number] }>()
const grid = ref<HTMLElement | null>(null)
const observed = new Set<HTMLElement>()
let observer: ResizeObserver | undefined,
  frame = 0,
  mounted = false

function arrange() {
  frame = 0
  const root = grid.value
  if (!mounted || !root || !root.clientWidth) return
  const cards = [...root.children] as HTMLElement[]
  const styles = getComputedStyle(root)
  const columns = Number.parseInt(styles.getPropertyValue('--columns'), 10) || 1
  const gap = Number.parseFloat(styles.columnGap) || 0
  const width = root.clientWidth
  const { columnWidth } = promptGridLayout([], width, columns, gap)
  // 分批写入宽度、读取自然高度、再写入坐标，避免逐卡交错读写触发反复布局。
  for (const card of cards) card.style.width = `${columnWidth}px`
  const layout = promptGridLayout(
    cards.map((card) => card.getBoundingClientRect().height),
    width,
    columns,
    gap,
  )
  root.style.height = `${layout.height}px`
  root.dataset.masonry = 'true'
  cards.forEach((card, index) => {
    const position = layout.positions[index]!
    card.style.left = `${position.left}px`
    card.style.top = `${position.top}px`
  })
}
function schedule() {
  if (mounted && !frame) frame = requestAnimationFrame(arrange)
}
function observeCards() {
  if (!mounted || !grid.value) return
  const cards = new Set([...grid.value.children] as HTMLElement[])
  for (const card of observed)
    if (!cards.has(card)) {
      observer?.unobserve(card)
      observed.delete(card)
    }
  for (const card of cards)
    if (!observed.has(card)) {
      observer?.observe(card)
      observed.add(card)
    }
  schedule()
}
watch(() => [props.items, props.ready, props.editable, props.draft], observeCards, { deep: true, flush: 'post' })
onMounted(() => {
  mounted = true
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule)
    if (grid.value) observer.observe(grid.value)
  }
  window.addEventListener('resize', schedule)
  observeCards()
})
onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
  observed.clear()
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', schedule)
})
</script>
<style scoped>
.prompts-grid {
  container-type: inline-size;
  min-width: 0;
}
.prompt-grid__layout {
  --columns: 1;
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  align-items: start;
  gap: 0.75rem;
  position: relative;
}
.prompt-grid__item {
  min-width: 0;
}
.prompt-grid__item :deep(.prompt-card) {
  margin: 0;
}
.prompt-grid__layout[data-masonry] > .prompt-grid__item {
  position: absolute;
}
@container (min-width: 290px) {
  .prompt-grid__layout {
    --columns: 2;
  }
}
@container (min-width: 700px) {
  .prompt-grid__layout {
    --columns: 3;
    gap: 1.25rem;
  }
}
@container (min-width: 980px) {
  .prompt-grid__layout {
    --columns: 4;
    gap: 1.5rem;
  }
}
</style>
