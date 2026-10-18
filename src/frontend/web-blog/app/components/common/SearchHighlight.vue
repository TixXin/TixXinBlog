<!-- @file SearchHighlight.vue @description 搜索关键词高亮；保留原文并以文本节点安全渲染。 -->
<template>
  <span class="search-highlight"
    ><template v-for="(part, index) in parts" :key="index"
      ><mark v-if="part.match" class="search-highlight__match">{{ part.text }}</mark
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlight } from '~/utils/splitHighlight'

const props = defineProps<{ text: string; keyword?: string | null }>()
const parts = computed(() => splitHighlight(props.text, props.keyword))
</script>

<style scoped>
/* 复用留言高亮的实色组合，在三主题的明暗背景上保持文字对比度。 */
.search-highlight__match {
  padding: 0;
  border-radius: 0.125rem;
  color: #1e293b;
  background: #fde68a;
}
</style>
