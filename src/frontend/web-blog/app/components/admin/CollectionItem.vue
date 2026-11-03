<!--
  @file CollectionItem.vue
  @description 后台集合列表（图库、项目、友链）的卡片项：可选封面列、标题、元信息、简介，补充行与操作区由插槽提供
-->
<template>
  <li class="admin-collection-item" :class="{ 'admin-collection-item--media': !!$slots.media }">
    <div v-if="$slots.media" class="admin-collection-item__media"><slot name="media" /></div>
    <div class="admin-collection-item__body">
      <h2>{{ title }}</h2>
      <p>{{ meta }}</p>
      <p>{{ description }}</p>
      <slot />
      <slot name="actions" />
    </div>
  </li>
</template>

<script setup lang="ts">
defineProps<{ title: string; meta: string; description: string }>()
</script>

<style scoped lang="scss">
.admin-collection-item {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
}
.admin-collection-item--media {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 1rem;
}
.admin-collection-item__body {
  min-width: 0;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p,
:slotted(p) {
  color: var(--text-muted);
  margin-block: 0.5rem;
  white-space: pre-wrap;
}
@media (max-width: 600px) {
  .admin-collection-item--media {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-collection-item__media {
    max-width: 260px;
  }
}
</style>
