<!-- @file ProfileContent.vue @description 仅展示已选择公开的个人资料，空栏目不占位 -->
<template>
  <div v-if="visible.visible" class="profile-content">
    <p v-if="visible.introduction" class="profile-content__intro">{{ visible.introduction }}</p>
    <section v-for="section in visible.sections" :key="section.kind">
      <h2>{{ aboutSectionLabels[section.kind] }}</h2>
      <ol>
        <li v-for="(item, index) in section.items" :key="index">
          <h3>{{ item.title }}</h3>
          <p v-if="item.period" class="profile-content__period">{{ item.period }}</p>
          <p v-if="item.detail">{{ item.detail }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { AboutSettings } from '~/features/about/types'
import { aboutSectionLabels, publicAbout } from '~/features/about/settings'
const props = defineProps<{ value?: AboutSettings }>()
const visible = computed(() => publicAbout(props.value))
</script>
<style scoped lang="scss">
.profile-content {
  overflow-wrap: anywhere;
}
section {
  margin-block: 2rem;
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
h3 {
  font-weight: 600;
}
ol {
  list-style: none;
  padding: 0;
}
li {
  padding: 1rem;
  margin-block: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
p {
  white-space: pre-wrap;
  line-height: 1.8;
  color: var(--text-muted);
}
.profile-content__period {
  font-size: 0.85rem;
}
</style>
