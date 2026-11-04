<!--
  @file LiveOnlineBadge.vue
  @description 底栏“N 人在线”：来自实时在线心跳，拿到首个结果前与后台关闭公开统计时不渲染
-->

<template>
  <span v-if="online !== null" class="live-online" :title="$t('layout.presence.onlineCountLabel')">
    <span class="live-online__dot" aria-hidden="true" />
    <span>{{ $t('layout.presence.onlineCount', { count: formatNumber(online) }) }}</span>
  </span>
</template>

<script setup lang="ts">
import { useLivePresenceState } from '~/composables/useLivePresence'
import { formatNumber } from '~/utils/format'

const live = useLivePresenceState()
const online = computed(() => live.value?.online ?? null)
</script>

<style lang="scss" scoped>
.live-online {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.live-online__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--stat-green-dot);
  box-shadow: 0 0 0 2px var(--stat-green-bg);
}
</style>
