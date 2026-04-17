<!--
  @file FlashTimeCapsuleCard.vue
  @description 闪念时间胶囊侧栏卡：去年今日 + 随机回顾
  @author TixXin
  @since 2026-04-17
-->

<template>
  <section v-if="hasContent" class="card flash-capsule-card">
    <div class="flash-capsule-card__header">
      <h3 class="flash-capsule-card__title">
        <Icon name="lucide:hourglass" size="16" />
        时间胶囊
      </h3>
    </div>

    <div v-if="throwback" class="flash-capsule-card__block">
      <div class="flash-capsule-card__label">
        <Icon name="lucide:calendar-clock" size="12" />
        <span>去年今日</span>
      </div>
      <NuxtLink :to="`/flash/${throwback.id}`" class="flash-capsule-card__item">
        <p class="flash-capsule-card__excerpt">{{ truncate(throwback.content, 60) }}</p>
        <span class="flash-capsule-card__meta">{{ formatDate(throwback.createdAt) }}</span>
      </NuxtLink>
    </div>

    <div v-if="randomNote" class="flash-capsule-card__block">
      <div class="flash-capsule-card__label">
        <Icon name="lucide:shuffle" size="12" />
        <span>随机回顾</span>
        <button
          type="button"
          class="flash-capsule-card__refresh"
          aria-label="换一条"
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
import type { FlashNote } from '~/features/flash/types'

const props = defineProps<{
  notes: FlashNote[]
}>()

// 去年今日：月日匹配且年份更早，取最近一条
const throwback = computed<FlashNote | null>(() => {
  const today = new Date()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayMd = `${mm}-${dd}`
  const todayYear = today.getFullYear()

  const hits = props.notes
    .filter((n) => {
      const d = new Date(n.createdAt)
      const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return md === todayMd && d.getFullYear() < todayYear
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return hits[0] ?? null
})

// 随机回顾：onMounted 后初始化种子，避免 SSR/CSR 不一致
const randomSeed = ref(0)
const randomNote = computed<FlashNote | null>(() => {
  if (props.notes.length === 0) return null
  const idx = randomSeed.value % props.notes.length
  return props.notes[idx] ?? null
})

function rollRandom() {
  if (props.notes.length <= 1) return
  let next = Math.floor(Math.random() * props.notes.length)
  if (next === randomSeed.value % props.notes.length) {
    next = (next + 1) % props.notes.length
  }
  randomSeed.value = next
}

onMounted(() => {
  if (props.notes.length > 1) {
    randomSeed.value = Math.floor(Math.random() * props.notes.length)
  }
})

const hasContent = computed(() => !!throwback.value || !!randomNote.value)

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ')
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  margin-left: auto;
  padding: 0.125rem;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  border-radius: $radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.18s, background 0.18s;

  &:hover {
    color: var(--accent);
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
