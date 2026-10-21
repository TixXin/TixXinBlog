<!-- @file ProjectFocusSection.vue @description URL 指定项目时的高亮聚焦区块与关联内容展示 -->
<template>
  <section ref="focusedProject" class="projects-focus" tabindex="-1" :aria-label="$t('misc.project.focus.label')">
    <header>
      <h2>{{ $t('misc.project.focus.title') }}</h2>
      <button type="button" @click="focus.close">{{ $t('misc.project.focus.close') }}</button>
    </header>
    <CommonRequestFeedback
      v-if="focus.pending.value || focus.error.value"
      :pending="focus.pending.value"
      :title="focus.error.value || $t('misc.project.focus.loading')"
      @retry="focus.load"
    />
    <ProjectCard
      v-if="focus.item.value"
      :project="focus.item.value"
      :interactive="interactive"
      @tag="emit('tag', $event)"
    />
    <CommonRelatedContent :items="focus.item.value?.relatedContent" />
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  focus: ReturnType<typeof useProjectFocus>
  interactive: boolean
}>()

const emit = defineEmits<{
  (e: 'tag', tag: string): void
}>()

const focusedProject = ref<HTMLElement | null>(null)

watch([props.focus.item, props.focus.error], async () => {
  if (!props.focus.target.value || props.focus.pending.value) return
  await nextTick()
  focusedProject.value?.focus({ preventScroll: true })
  focusedProject.value?.scrollIntoView({ block: 'start' })
})
</script>

<style scoped lang="scss">
.projects-focus {
  margin-bottom: 1.5rem;
  min-width: 0;
}
.projects-focus header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.projects-focus h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
.projects-focus button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
</style>
