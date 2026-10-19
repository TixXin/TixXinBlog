<!--
  @file FlashTimeCapsuleCard.vue
  @description 闪念时间胶囊侧栏卡：往年今日 + 随机回顾，数据来自闪念概览
  @author TixXin
  @since 2026-04-17
-->

<template>
  <section v-if="hasContent" class="card flash-capsule-card">
    <div class="flash-capsule-card__header">
      <h2 class="flash-capsule-card__title">
        <Icon name="lucide:hourglass" size="16" />
        {{ $t('layout.sidebar.capsule.title') }}
      </h2>
    </div>

    <div v-if="throwback" class="flash-capsule-card__block">
      <div class="flash-capsule-card__label">
        <Icon name="lucide:calendar-clock" size="12" />
        <span>{{ $t('layout.sidebar.capsule.onThisDay') }}</span>
      </div>
      <NuxtLink :to="`/flash/${throwback.id}`" class="flash-capsule-card__item">
        <p class="flash-capsule-card__excerpt">{{ truncate(throwback.content, 60) }}</p>
        <span class="flash-capsule-card__meta">{{ formatDate(throwback.createdAt) }}</span>
      </NuxtLink>
    </div>

    <div v-if="randomNote" class="flash-capsule-card__block">
      <div class="flash-capsule-card__label">
        <Icon name="lucide:shuffle" size="12" />
        <span>{{ $t('layout.sidebar.capsule.random') }}</span>
        <button
          type="button"
          class="flash-capsule-card__refresh"
          :aria-label="$t('layout.sidebar.capsule.reroll')"
          @click.stop.prevent="rollRandom"
        >
          <Icon name="lucide:refresh-cw" size="11" />
        </button>
      </div>
      <NuxtLink :to="`/flash/${randomNote.id}`" class="flash-capsule-card__item">
        <p class="flash-capsule-card__excerpt">{{ truncate(randomNote.content, 60) }}</p>
        <span class="flash-capsule-card__meta">{{ formatDate(randomNote.createdAt) }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { markdownPlainText } from '~/utils/markdownPlainText'
import type { FlashRecollection } from '~/features/flash/types'

const props = defineProps<{
  /** 往年今日（UTC 月日相同、年份更早）最近一条，由闪念概览提供 */
  onThisDay: FlashRecollection | null
  /** 随机回顾候选（概览接口随机抽取的摘录） */
  recollections: FlashRecollection[]
}>()

const throwback = computed(() => props.onThisDay)

// 随机回顾：onMounted 后初始化种子，避免 SSR/CSR 不一致
const randomSeed = ref(0)
const randomNote = computed<FlashRecollection | null>(() => {
  if (props.recollections.length === 0) return null
  const idx = randomSeed.value % props.recollections.length
  return props.recollections[idx] ?? null
})

function rollRandom() {
  if (props.recollections.length <= 1) return
  let next = Math.floor(Math.random() * props.recollections.length)
  if (next === randomSeed.value % props.recollections.length) {
    next = (next + 1) % props.recollections.length
  }
  randomSeed.value = next
}

onMounted(() => {
  if (props.recollections.length > 1) {
    randomSeed.value = Math.floor(Math.random() * props.recollections.length)
  }
})

const hasContent = computed(() => !!throwback.value || !!randomNote.value)

// 侧栏不渲染富文本，先去掉 Markdown 标记，避免露出 `- [x]`、`**` 等原始符号
function truncate(s: string, n: number) {
  const t = markdownPlainText(s)
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/** 日期按 UTC 展示，与发布日历和“往年今日”的匹配口径一致 */
function formatDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}
</script>

<style lang="scss" scoped>
.flash-capsule-card {
  padding: 1rem;
}

.flash-capsule-card__header {
  margin-bottom: 0.75rem;
}

.flash-capsule-card__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.flash-capsule-card__block {
  margin-top: 0.75rem;

  &:first-of-type {
    margin-top: 0;
  }
}

.flash-capsule-card__label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
  margin-bottom: 0.375rem;
}

.flash-capsule-card__refresh {
  position: relative;
  margin-left: auto;
  padding: 0.125rem;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);
  border-radius: $radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉 15px 不变，伪元素把点击区扩到 25px
  &::after {
    content: '';
    position: absolute;
    inset: -5px;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--surface-2);
  }
}

.flash-capsule-card__item {
  display: block;
  padding: 0.625rem 0.75rem;
  background: var(--surface-2);
  border-radius: $radius-sm;
  text-decoration: none;
  color: inherit;
  transition: background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-3);
  }
}

.flash-capsule-card__excerpt {
  margin: 0 0 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-main);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.flash-capsule-card__meta {
  font-size: 0.6875rem;
  color: var(--text-faint);
}
</style>
