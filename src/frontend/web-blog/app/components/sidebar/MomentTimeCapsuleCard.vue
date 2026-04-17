<!--
  @file MomentTimeCapsuleCard.vue
  @description 朋友圈时间胶囊侧栏卡：去年今日 + 随机回顾
  @author TixXin
  @since 2026-04-17
-->

<template>
  <section v-if="hasContent" class="card moment-capsule-card">
    <div class="moment-capsule-card__header">
      <h3 class="moment-capsule-card__title">
        <Icon name="lucide:hourglass" size="16" />
        时间胶囊
      </h3>
    </div>

    <!-- 去年今日 -->
    <div v-if="throwback" class="moment-capsule-card__block">
      <div class="moment-capsule-card__label">
        <Icon name="lucide:calendar-clock" size="12" />
        <span>去年今日</span>
      </div>
      <NuxtLink :to="`/moments/${throwback.id}`" class="moment-capsule-card__item">
        <p class="moment-capsule-card__excerpt">{{ truncate(throwback.content, 60) }}</p>
        <span class="moment-capsule-card__meta">{{ formatDate(throwback.date) }}</span>
      </NuxtLink>
    </div>

    <!-- 随机回顾 -->
    <div v-if="randomMoment" class="moment-capsule-card__block">
      <div class="moment-capsule-card__label">
        <Icon name="lucide:shuffle" size="12" />
        <span>随机回顾</span>
        <button
          type="button"
          class="moment-capsule-card__refresh"
          aria-label="换一条"
          @click.stop.prevent="rollRandom"
        >
          <Icon name="lucide:refresh-cw" size="11" />
        </button>
      </div>
      <NuxtLink :to="`/moments/${randomMoment.id}`" class="moment-capsule-card__item">
        <p class="moment-capsule-card__excerpt">{{ truncate(randomMoment.content, 60) }}</p>
        <span class="moment-capsule-card__meta">{{ formatDate(randomMoment.date) }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MomentItem } from '~/features/moment/types'

const props = defineProps<{
  moments: MomentItem[]
}>()

// 去年今日：找出"月日"匹配且年份更早的最近一条
const throwback = computed<MomentItem | null>(() => {
  const today = new Date()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayMd = `${mm}-${dd}`
  const todayYear = today.getFullYear()

  const hits = props.moments
    .filter((m) => {
      const d = new Date(m.date)
      const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return md === todayMd && d.getFullYear() < todayYear
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return hits[0] ?? null
})

// 随机回顾：每次 rollRandom 重新选；初始用稳定值避免 hydration mismatch
const randomSeed = ref(0)
const randomMoment = computed<MomentItem | null>(() => {
  if (props.moments.length === 0) return null
  const idx = randomSeed.value % props.moments.length
  return props.moments[idx] ?? null
})

function rollRandom() {
  if (props.moments.length <= 1) return
  let next = Math.floor(Math.random() * props.moments.length)
  if (next === randomSeed.value % props.moments.length) {
    next = (next + 1) % props.moments.length
  }
  randomSeed.value = next
}

// 客户端 mounted 后初始化随机种子，避免 SSR/CSR 不一致
onMounted(() => {
  if (props.moments.length > 1) {
    randomSeed.value = Math.floor(Math.random() * props.moments.length)
  }
})

const hasContent = computed(() => !!throwback.value || !!randomMoment.value)

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
.moment-capsule-card {
  padding: 1rem;
}

.moment-capsule-card__header {
  margin-bottom: 0.75rem;
}

.moment-capsule-card__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.moment-capsule-card__block {
  margin-top: 0.75rem;

  &:first-of-type {
    margin-top: 0;
  }
}

.moment-capsule-card__label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-faint);
  margin-bottom: 0.375rem;
}

.moment-capsule-card__refresh {
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
  transition: $transition-colors;

  &:hover {
    color: var(--accent);
    background: var(--surface-2);
  }
}

.moment-capsule-card__item {
  display: block;
  padding: 0.625rem 0.75rem;
  background: var(--surface-2);
  border-radius: $radius-sm;
  text-decoration: none;
  color: inherit;
  transition: $transition-colors;

  &:hover {
    background: var(--surface-3);
  }
}

.moment-capsule-card__excerpt {
  margin: 0 0 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-main);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.moment-capsule-card__meta {
  font-size: 0.6875rem;
  color: var(--text-faint);
}
</style>
