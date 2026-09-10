<!-- @file LinkStats.vue @description 公开友链真实统计，推荐与域名数均来自当前记录 -->
<template>
  <section class="card link-stats">
    <h3><Icon name="lucide:chart-no-axes-column" size="16" />友链概览</h3>
    <dl>
      <div>
        <dt>公开友链</dt>
        <dd>{{ stats.links }}</dd>
      </div>
      <div>
        <dt>推荐</dt>
        <dd>{{ stats.featured }}</dd>
      </div>
      <div>
        <dt>不同域名</dt>
        <dd>{{ stats.domains }}</dd>
      </div>
    </dl>
    <p>推荐由博主维护，不代表已验证互链。</p>
  </section>
</template>
<script setup lang="ts">
import type { LinkMetadata } from '~/features/link/types'
defineProps<{ stats: LinkMetadata['stats'] }>()
</script>
<style scoped>
.link-stats {
  padding: 1.25rem;
}
h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
dl {
  display: grid;
  gap: 0.75rem;
}
dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
dt,
p {
  color: var(--text-muted);
  font-size: 0.8125rem;
}
dd {
  margin: 0;
  font-weight: 700;
}
p {
  margin-top: 0.75rem;
  line-height: 1.65;
}
</style>
