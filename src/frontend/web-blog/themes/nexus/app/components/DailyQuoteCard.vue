<!--
  @file DailyQuoteCard.vue
  @description Nexus 左侧栏每日一言卡片，随机展示站点设置中的一言并支持刷新；列表为空时不展示
  @author TixXin
  @since 2026-04-10
-->

<template>
  <section v-if="dailyQuote" class="card daily-quote-card">
    <!-- 装饰引号 -->
    <Icon name="lucide:quote" size="20" class="daily-quote-card__decor-icon" />

    <!-- 名言文本 -->
    <p class="daily-quote-card__text">{{ dailyQuote }}</p>

    <!-- 刷新按钮 -->
    <button class="daily-quote-card__refresh" :aria-label="$t('theme.nexus.quote.refresh')" @click="refresh">
      <Icon
        name="lucide:refresh-cw"
        size="12"
        class="daily-quote-card__refresh-icon"
        :style="{ transform: `rotate(${rotation}deg)` }"
      />
    </button>
  </section>
</template>

<script setup lang="ts">
const { dailyQuote, ownerCard } = useSiteInfo()
const rotation = ref(0)

function refresh() {
  const quotes = ownerCard.value.quotes
  const current = dailyQuote.value
  let next = current
  /* 避免连续出现同一条 */
  while (next === current && quotes.length > 1) {
    next = quotes[Math.floor(Math.random() * quotes.length)]
  }
  dailyQuote.value = next
  rotation.value += 180
}
</script>

<style lang="scss" scoped>
.daily-quote-card {
  padding: 1rem 1.25rem;
  position: relative;
  border-left: 2px solid var(--accent);
}

/* 装饰引号图标 */
.daily-quote-card__decor-icon {
  color: var(--accent-text);
  opacity: 0.25;
  margin-bottom: 0.25rem;
}

/* 名言文本 */
.daily-quote-card__text {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.7;
  font-style: italic;
}

/* 刷新按钮 */
.daily-quote-card__refresh {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}

.daily-quote-card__refresh-icon {
  transition: transform 0.4s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
