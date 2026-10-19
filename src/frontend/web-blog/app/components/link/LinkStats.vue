<!-- @file LinkStats.vue @description 公开友链真实统计，推荐与域名数均来自当前记录 -->
<template>
  <section class="card link-stats">
    <h2><Icon name="lucide:chart-no-axes-column" size="16" />{{ $t('interaction.linkStats.title') }}</h2>
    <dl>
      <div>
        <dt>{{ $t('interaction.linkStats.links') }}</dt>
        <dd>{{ stats.links }}</dd>
      </div>
      <div>
        <dt>{{ $t('interaction.linkStats.featured') }}</dt>
        <dd>{{ stats.featured }}</dd>
      </div>
      <div>
        <dt>{{ $t('interaction.linkStats.domains') }}</dt>
        <dd>{{ stats.domains }}</dd>
      </div>
    </dl>
    <p>{{ $t('interaction.linkStats.note') }}</p>
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
h2 {
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
