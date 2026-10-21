<!-- @file PromptIntro.vue @description 提示词页面横幅：灵感主题介绍与总数统计 -->
<template>
  <section class="prompts-intro" :aria-label="$t('misc.prompt.page.introLabel')">
    <div>
      <p class="prompts-kicker">IMAGE PROMPT COLLECTION</p>
      <p class="prompts-intro__title">
        {{ $t('misc.prompt.page.introTitle') }}<span>{{ $t('misc.prompt.page.introTitleAccent') }}</span>
      </p>
      <p class="prompts-intro__description">{{ $t('misc.prompt.page.introDescription') }}</p>
    </div>
    <div v-if="metadata" class="prompts-intro__index" :aria-label="$t('misc.prompt.page.countLabel')">
      <strong>{{ String(metadata.stats.prompts).padStart(2, '0') }}</strong
      ><span class="prompts-intro__label">{{ $t('misc.prompt.page.countUnit') }}</span
      ><Icon name="lucide:move-up-right" size="22" />
    </div>
  </section>
</template>
<script setup lang="ts">
import type { PromptMetadata } from '~/features/prompt/types'

defineProps<{
  metadata?: PromptMetadata | null
}>()
</script>
<style scoped lang="scss">
.prompts-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.2rem 0 1.35rem;
  border-bottom: 1px solid var(--border);
}
.prompts-kicker {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  color: var(--text-soft);
  font-weight: 500;
}
.prompts-intro__title {
  font-size: clamp(1.4rem, 2.7vw, 2.25rem);
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1.5;
  margin: 0.6rem 0;
  color: var(--text-main);
}
.prompts-intro__title span {
  color: var(--text-soft);
}
.prompts-intro__description {
  color: var(--text-soft);
  font-size: 0.78rem;
  line-height: 1.8;
}
.prompts-intro__index {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 1rem;
  min-width: 120px;
  color: var(--text-soft);
}
.prompts-intro__index strong {
  font-variant-numeric: tabular-nums;
  font-size: 2.8rem;
  line-height: 1.2;
  font-weight: 300;
  letter-spacing: -0.05em;
  color: var(--text-main);
}
.prompts-intro__label {
  grid-column: 1 / -1;
  grid-row: 2;
  font-size: 0.6rem;
  padding-top: 0.4rem;
}
.prompts-intro__index > :last-child {
  align-self: center;
  grid-column: 2;
  grid-row: 1;
}
@media (max-width: 1050px) {
  .prompts-intro__index {
    min-width: auto;
  }
}
@media (max-width: 640px) {
  .prompts-intro {
    padding-bottom: 0.9rem;
    gap: 1rem;
  }
  .prompts-intro__title {
    font-size: 1.3rem;
  }
  .prompts-intro__title span {
    display: block;
  }
  .prompts-intro__description {
    max-width: 240px;
    font-size: 0.72rem;
  }
  .prompts-intro__index strong {
    font-size: 2.2rem;
  }
  .prompts-intro__label {
    width: 80px;
    font-size: 0.55rem;
  }
  .prompts-intro__index > :last-child {
    display: none;
  }
  .prompts-kicker {
    font-size: 0.5rem;
  }
}
</style>
