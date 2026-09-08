<!--
  @file SiteAnnouncement.vue
  @description 三套主题共用的真实站点公告，内容由布局传入。
-->
<template>
  <aside v-if="content" class="site-announcement" aria-label="站点公告">
    <Icon name="lucide:megaphone" />
    <p>{{ content }}</p>
    <time v-if="date" :datetime="date">{{ date.slice(0, 10) }}</time>
  </aside>
</template>
<script setup lang="ts">
defineProps<{ content: string; date: string }>()
</script>
<style scoped>
.site-announcement {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 1rem;
  margin: 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  color: var(--text-main);
}
p {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
time {
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
