<!-- @file Detail.vue @description 提示词阅读浮层，完整文本、复制反馈和可分享链接 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dialog"
      class="prompt-detail"
      role="dialog"
      aria-modal="true"
      :aria-label="item?.title || '图片提示词'"
      tabindex="-1"
      @click.self="$emit('close')"
    >
      <div class="prompt-detail__panel">
        <button class="prompt-detail__close" type="button" aria-label="关闭提示词详情" @click="$emit('close')">
          <Icon name="lucide:x" size="20" />
        </button>
        <div v-if="pending || error" class="prompt-detail__feedback">
          <CommonRequestFeedback :pending="pending" :title="error || '正在读取提示词'" @retry="$emit('retry')" />
        </div>
        <template v-else-if="item">
          <div class="prompt-detail__image">
            <CommonImageFrame
              :src="item.imageUrl"
              :alt="item.imageAlt || item.title"
              :width="item.width || undefined"
              :height="item.height || undefined"
              fit="contain"
              loading="eager"
            />
          </div>
          <div class="prompt-detail__body">
            <p class="prompt-detail__eyebrow">
              <Icon name="lucide:aperture" size="14" />{{ item.model || '灵感图鉴'
              }}<span v-if="draft">仅博主可见</span>
            </p>
            <h2>{{ item.title }}</h2>
            <p v-if="item.description" class="prompt-detail__description">{{ item.description }}</p>
            <div v-if="item.tags.length" class="prompt-detail__tags">
              <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            </div>
            <section class="prompt-detail__text">
              <header>
                <h3>图片提示词</h3>
                <button type="button" @click="copy(item.prompt, 'prompt')">
                  <Icon :name="copied === 'prompt' ? 'lucide:check' : 'lucide:copy'" size="15" />{{
                    copied === 'prompt' ? '已复制' : '复制提示词'
                  }}
                </button>
              </header>
              <p dir="auto">{{ item.prompt }}</p>
            </section>
            <section v-if="item.negativePrompt" class="prompt-detail__text prompt-detail__text--negative">
              <header>
                <h3>负面提示词</h3>
                <button type="button" @click="copy(item.negativePrompt, 'negative')">
                  <Icon :name="copied === 'negative' ? 'lucide:check' : 'lucide:copy'" size="14" />{{
                    copied === 'negative' ? '已复制' : '复制'
                  }}
                </button>
              </header>
              <p dir="auto">{{ item.negativePrompt }}</p>
            </section>
            <p class="prompt-detail__hint">把文字变成自己的画面。不同模型与参数，可能带来不同惊喜。</p>
            <footer>
              <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer"
                ><Icon name="lucide:external-link" size="15" />查看来源</a
              ><button v-if="!draft" type="button" @click="share">
                <Icon name="lucide:link" size="15" />{{ copied === 'link' ? '链接已复制' : '分享灵感' }}</button
              ><button v-if="editable" type="button" @click="$emit('edit', item.id)">
                <Icon name="lucide:pencil" size="15" />编辑
              </button>
            </footer>
            <p v-if="copyMessage" role="status" class="prompt-detail__copy-status">{{ copyMessage }}</p>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { ImagePrompt } from '~/features/prompt/types'
const props = defineProps<{
  visible: boolean
  item: ImagePrompt | null
  pending: boolean
  error: string
  editable: boolean
  draft: boolean
}>()
const emit = defineEmits<{ close: []; retry: []; edit: [id: number] }>()
const dialog = ref<HTMLElement | null>(null),
  copied = ref(''),
  copyMessage = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
useModalFocus(() => props.visible, dialog, { close: () => emit('close') })
async function copy(text: string, kind: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = kind
    copyMessage.value = kind === 'link' ? '分享链接已复制。' : '提示词已复制到剪贴板。'
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = ''
      copyMessage.value = ''
    }, 2500)
  } catch {
    copyMessage.value = '复制失败，可以选中上方文本手动复制。'
  }
}
function share() {
  if (props.item) void copy(`${window.location.origin}/prompts?prompt=${props.item.id}`, 'link')
}
watch(
  () => props.item?.id,
  () => {
    copied.value = ''
    copyMessage.value = ''
    clearTimeout(timer)
  },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>
<style scoped lang="scss">
.prompt-detail {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(10, 14, 20, 0.65);
  backdrop-filter: blur(8px);
}
.prompt-detail__panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  width: min(1080px, 100%);
  max-height: min(88dvh, 920px);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  background: var(--surface-1);
  box-shadow: 0 20px 80px #0003;
}
.prompt-detail__close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  z-index: 3;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface-1);
  color: var(--text-main);
}
.prompt-detail__image {
  min-height: 420px;
  position: sticky;
  top: 0;
  height: min(88dvh, 920px);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  background: var(--surface-2);
}
.prompt-detail__image :deep(.image-frame) {
  max-height: 100%;
}
.prompt-detail__body {
  min-width: 0;
  padding: 3.5rem 2rem 2rem;
  color: var(--text-main);
}
.prompt-detail__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.prompt-detail__eyebrow span {
  margin-left: auto;
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
.prompt-detail__copy-status {
  font-size: 0.75rem;
  color: var(--accent-text);
}
.prompt-detail__feedback {
  grid-column: 1 / -1;
  min-height: 200px;
  padding: 3rem;
}
@media (max-width: 700px) {
  .prompt-detail {
    padding: 0.75rem;
  }
  .prompt-detail__panel {
    display: block;
    max-height: 94dvh;
  }
  .prompt-detail__image {
    position: static;
    height: 38dvh;
    min-height: 220px;
    padding: 1rem;
  }
  .prompt-detail__body {
    padding: 1.5rem;
  }
  h2 {
    font-size: 1.3rem;
  }
}
</style>
