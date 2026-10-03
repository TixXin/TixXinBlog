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
        <header class="prompt-detail__toolbar">
          <span
            ><Icon :name="draft ? 'lucide:lock-keyhole' : 'lucide:aperture'" size="15" />{{
              draft ? '草稿 · 仅博主可见' : '图片与创作提示词'
            }}</span
          >
          <button class="prompt-detail__close" type="button" aria-label="关闭提示词详情" @click="$emit('close')">
            <Icon name="lucide:x" size="20" />
          </button>
        </header>
        <div v-if="copyMessage" class="prompt-detail__notice">
          <p role="status" class="prompt-detail__copy-status">{{ copyMessage }}</p>
          <label v-if="manualLink" class="prompt-detail__manual-link"
            >分享链接<input :value="manualLink" readonly @focus="($event.target as HTMLInputElement).select()"
          /></label>
        </div>
        <div class="prompt-detail__content">
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
              <a class="prompt-detail__original" :href="item.imageUrl" target="_blank" rel="noopener noreferrer">
                <Icon name="lucide:expand" size="14" />查看原图<span class="sr-only">（在新标签页打开）</span>
              </a>
            </div>
            <div class="prompt-detail__body">
              <p class="prompt-detail__eyebrow">
                <span>{{ item.model || '模型未标注' }}</span
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
                    <h3>图片提示词</h3>
                    <span class="prompt-detail__length">{{ item.prompt.length.toLocaleString('zh-CN') }} 字符</span>
                  </div>
                  <button type="button" :disabled="copying" @click="copy(item.prompt, 'prompt')">
                    <Icon :name="copied === 'prompt' ? 'lucide:check' : 'lucide:copy'" size="15" />{{
                      copied === 'prompt' ? '已复制' : '复制提示词'
                    }}
                  </button>
                </header>
                <p dir="auto">{{ item.prompt }}</p>
              </section>
              <section v-if="item.negativePrompt" class="prompt-detail__text prompt-detail__text--negative">
                <header>
                  <div>
                    <h3>负面提示词</h3>
                    <span class="prompt-detail__length"
                      >{{ item.negativePrompt.length.toLocaleString('zh-CN') }} 字符</span
                    >
                  </div>
                  <button type="button" :disabled="copying" @click="copy(item.negativePrompt, 'negative')">
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
                ><button v-if="!draft" type="button" :disabled="copying" @click="share">
                  <Icon name="lucide:link" size="15" />{{ copied === 'link' ? '链接已复制' : '分享灵感' }}</button
                ><button v-if="editable" type="button" @click="$emit('edit', item.id)">
                  <Icon name="lucide:pencil" size="15" />编辑
                </button>
              </footer>
            </div>
          </template>
        </div>
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
  copyMessage = ref(''),
  copying = ref(false),
  manualLink = ref('')
let copyGeneration = 0
let timer: ReturnType<typeof setTimeout> | undefined
useModalFocus(() => props.visible, dialog, { close: () => emit('close') })
async function copy(text: string, kind: string) {
  if (copying.value) return
  const generation = ++copyGeneration
  clearTimeout(timer)
  copying.value = true
  copied.value = ''
  manualLink.value = ''
  copyMessage.value = ''
  try {
    await navigator.clipboard.writeText(text)
    if (generation !== copyGeneration || !props.visible) return
    copied.value = kind
    copyMessage.value = kind === 'link' ? '分享链接已复制。' : '提示词已复制到剪贴板。'
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = ''
      copyMessage.value = ''
    }, 2500)
  } catch {
    if (generation !== copyGeneration || !props.visible) return
    copied.value = ''
    if (kind === 'link') {
      manualLink.value = text
      copyMessage.value = '无法访问剪贴板，请选中下方链接手动复制。'
    } else copyMessage.value = '复制失败，可以选中提示词文本手动复制。'
  } finally {
    if (generation === copyGeneration) copying.value = false
  }
}
function share() {
  if (props.item) void copy(`${window.location.origin}/prompts?prompt=${props.item.id}`, 'link')
}
watch([() => props.visible, () => props.item], () => {
  copyGeneration++
  copying.value = false
  copied.value = ''
  copyMessage.value = ''
  manualLink.value = ''
  clearTimeout(timer)
})
onBeforeUnmount(() => {
  copyGeneration++
  clearTimeout(timer)
})
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
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  max-height: min(90dvh, 960px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  background: var(--surface-1);
  box-shadow: 0 20px 80px #0003;
}
.prompt-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0.6rem 0.9rem 0.6rem 1.4rem;
  border-bottom: 1px solid var(--border);
}
.prompt-detail__toolbar > span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompt-detail__content {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  overflow: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
.prompt-detail__close {
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
  min-height: min(320px, 60dvh);
  position: sticky;
  top: 0;
  height: min(78dvh, 820px);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  background: var(--surface-2);
}
.prompt-detail__image :deep(.image-frame) {
  max-height: 100%;
}
.prompt-detail__original {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  color: var(--text-main);
  background: var(--surface-1);
  font-size: 0.75rem;
}
.prompt-detail__original:hover {
  color: var(--accent-text);
  border-color: var(--accent);
}
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
.prompt-detail__manual-link {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.75rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompt-detail__manual-link input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.6rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.prompt-detail__close:hover,
.prompt-detail__text button:not(:disabled):hover {
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
.prompt-detail__copy-status {
  font-size: 0.75rem;
  color: var(--accent-text);
  line-height: 1.7;
}
.prompt-detail__notice {
  flex-shrink: 0;
  padding: 0.65rem 1.4rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
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
    max-height: 94dvh;
  }
  .prompt-detail__content {
    display: block;
  }
  .prompt-detail__image {
    position: relative;
    height: 38dvh;
    min-height: min(180px, 30dvh);
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
