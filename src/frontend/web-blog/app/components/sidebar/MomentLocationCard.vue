<!--
  @file MomentLocationCard.vue
  @description 朋友圈右侧栏足迹卡：列出公开动态出现过的地点及动态数，点击按地点筛选；没有地点时不显示
  @author TixXin
  @since 2026-11-06
-->

<template>
  <section v-if="locations.length" class="card moment-location-card">
    <div class="moment-location-card__header">
      <h2 class="moment-location-card__title">
        <Icon name="lucide:map-pin" size="16" />
        {{ $t('layout.sidebar.locations.title') }}
      </h2>
      <button
        type="button"
        class="moment-location-card__all"
        :aria-pressed="!activeLocation"
        @click="emit('select', null)"
      >
        {{ $t('layout.sidebar.locations.all') }}
      </button>
    </div>
    <ul class="moment-location-card__list">
      <li v-for="item in locations" :key="item.name">
        <button
          type="button"
          class="moment-location-card__item"
          :aria-pressed="activeLocation === item.name"
          @click="emit('select', activeLocation === item.name ? null : item.name)"
        >
          <span class="moment-location-card__name">{{ item.name }}</span>
          <span class="moment-location-card__count">{{
            $t('layout.sidebar.locations.count', { count: item.count })
          }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  locations: { name: string; count: number }[]
  activeLocation?: string | null
}>()
const emit = defineEmits<{ select: [location: string | null] }>()
</script>

<style lang="scss" scoped>
.moment-location-card {
  padding: 1.25rem;
}

.moment-location-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.moment-location-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.moment-location-card__all {
  padding: 0.25rem 0.625rem;
  border: none;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);

  &[aria-pressed='true'] {
    color: var(--accent);
  }
}

.moment-location-card__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.moment-location-card__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-size: 0.75rem;
  cursor: var(--interaction-cursor, pointer);

  &[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent);
  }

  &:focus-visible,
  .moment-location-card__all:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}

.moment-location-card__count {
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}
</style>
