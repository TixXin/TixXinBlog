<!-- @file DetailBody.vue @description 提示词详情正文：模型标签、正负词复制与操作栏 -->
<template>
  <div class="prompt-detail__body">
    <p class="prompt-detail__eyebrow">
      <span>{{ item.model || $t('misc.prompt.shared.modelUnset') }}</span
      ><span v-if="item.width && item.height">{{ item.width }} × {{ item.height }}</span>
    </p>
    <h2>{{ item.title }}</h2>
    <p v-if="item.description" class="prompt-detail__description">{{ item.description }}</p>
    <div v-if="item.tags.length" class="prompt-detail__tags">
      <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
    </div>
    <section class="prompt-detail__text">
      <header>
        <div>
          <h3>{{ $t('misc.prompt.detail.promptHeading') }}</h3>
          <span class="prompt-detail__length">{{ characterCount(item.prompt) }}</span>
        </div>
        <button type="button" :aria-disabled="copying" @click="$emit('copy', item.prompt, 'prompt')">
          <Icon :name="copied === 'prompt' ? 'lucide:check' : 'lucide:copy'" size="15" />{{
            copied === 'prompt' ? $t('misc.prompt.detail.copied') : $t('misc.prompt.detail.copyPrompt')
          }}
        </button>
      </header>
      <p dir="auto">{{ item.prompt }}</p>
    </section>
    <section v-if="item.negativePrompt" class="prompt-detail__text prompt-detail__text--negative">
      <header>
        <div>
          <h3>{{ $t('misc.prompt.detail.negativeHeading') }}</h3>
          <span class="prompt-detail__length">{{ characterCount(item.negativePrompt) }}</span>
        </div>
        <button type="button" :aria-disabled="copying" @click="$emit('copy', item.negativePrompt, 'negative')">
          <Icon :name="copied === 'negative' ? 'lucide:check' : 'lucide:copy'" size="14" />{{
            copied === 'negative' ? $t('misc.prompt.detail.copied') : $t('misc.prompt.detail.copy')
          }}
        </button>
      </header>
      <p dir="auto">{{ item.negativePrompt }}</p>
    </section>
    <p class="prompt-detail__hint">{{ $t('misc.prompt.detail.hint') }}</p>
    <footer>
      <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer"
        ><Icon name="lucide:external-link" size="15" />{{ $t('misc.prompt.detail.viewSource') }}</a
      ><button v-if="!draft" type="button" :aria-disabled="copying" @click="$emit('share')">
        <Icon name="lucide:link" size="15" />{{
          copied === 'link' ? $t('misc.prompt.detail.linkCopied') : $t('misc.prompt.detail.share')
        }}</button
      ><button v-if="editable" type="button" @click="$emit('edit', item.id)">
        <Icon name="lucide:pencil" size="15" />{{ $t('misc.prompt.detail.edit') }}
      </button>
    </footer>
  </div>
</template>
<script setup lang="ts">
import type { ImagePrompt } from '~/features/prompt/types'
import { formatNumber } from '~/utils/format'

defineProps<{
  item: ImagePrompt
  editable: boolean
  draft: boolean
  copied: string
  copying: boolean
}>()

defineEmits<{
  copy: [text: string, kind: string]
  share: []
  edit: [id: number]
}>()

const { t } = useI18n()
/** 文本字符数：数字跟随界面语言格式化，英文按单复数变化 */
const characterCount = (text: string) =>
  t('misc.prompt.detail.characters', { count: formatNumber(text.length) }, text.length)
</script>
<style scoped lang="scss">
.prompt-detail__body {
  min-width: 0;
  padding: 1.5rem 2rem 2rem;
  overflow-wrap: anywhere;
  color: var(--text-main);
}
.prompt-detail__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.75rem;
  flex-wrap: wrap;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}
.prompt-detail__length {
  color: var(--text-soft);
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
}
.prompt-detail__text header > div {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.65rem;
}
button:disabled,
button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}
.prompt-detail__text button:not([aria-disabled='true']):hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

h2 {
  font-size: 1.6rem;
  line-height: 1.5;
  font-weight: 600;
  margin: 0.8rem 0;
}
.prompt-detail__description {
  color: var(--text-soft);
  font-size: 0.875rem;
  line-height: 1.9;
}
.prompt-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
.prompt-detail__tags span {
  font-size: 0.7rem;
  padding: 0.3rem 0.6rem;
  color: var(--text-muted);
  background: var(--surface-2);
  border-radius: 0.35rem;
}
.prompt-detail__text {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}
.prompt-detail__text header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
}
h3 {
  font-size: 0.8125rem;
  font-weight: 600;
}
.prompt-detail__text p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.95;
  font-size: 0.8125rem;
  margin-top: 0.75rem;
  user-select: text;
}
.prompt-detail__text--negative p {
  color: var(--text-soft);
}
button,
a {
  cursor: var(--interaction-cursor, pointer);
}
.prompt-detail__text button,
footer button,
footer a {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--accent-text);
}
.prompt-detail__text button {
  border: 1px solid var(--border);
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
}
.prompt-detail__hint {
  color: var(--text-soft);
  font-size: 0.7rem;
  line-height: 1.8;
  margin: 1.5rem 0 1rem;
}
footer {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}
@media (max-width: 700px) {
  .prompt-detail__body {
    padding: 1.5rem;
  }
  h2 {
    font-size: 1.3rem;
  }
}
</style>
