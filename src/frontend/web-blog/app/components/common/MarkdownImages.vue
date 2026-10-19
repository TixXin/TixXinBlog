<!-- @file MarkdownImages.vue @description 为净化后的 Markdown 图片挂载共享失败反馈，预览与链接保持为同级操作 -->
<template>
  <Teleport v-for="item in images" :key="item.key" :to="item.target">
    <CommonContentImage v-bind="item.attrs" native class="markdown-image__content" @state="updateState(item, $event)" />
    <button
      v-if="item.preview && !item.failed"
      type="button"
      class="markdown-image__action"
      data-article-image
      :aria-label="item.preview"
    />
    <a
      v-else-if="item.link && !item.failed"
      v-bind="item.link"
      class="markdown-image__action"
      :aria-label="item.attrs.alt || $t('layout.markdownImages.openLink')"
    />
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ root: HTMLElement | null; html: string }>()
const { t } = useI18n()
interface MarkdownImage {
  key: string
  target: HTMLElement
  attrs: Record<string, string>
  preview?: string
  link?: Record<string, string>
  failed: boolean
}
const images = ref<MarkdownImage[]>([])
let generation = 0
let lastRoot: HTMLElement | null = null
let lastHtml: string | undefined

function updateState(item: MarkdownImage, state: 'loading' | 'ready' | 'error' | 'empty') {
  // 重试完成前保留失败操作的焦点与点击区域，避免再次覆盖链接或灯箱触发器。
  if (state !== 'loading') item.failed = state === 'error' || state === 'empty'
}

/** 图片可以夹在链接文字或强调中；拆分前后片段，避免把重试按钮放进链接。 */
function splitLink(link: HTMLAnchorElement, image: HTMLImageElement, target: HTMLElement) {
  const before = document.createRange()
  before.selectNodeContents(link)
  before.setEndBefore(image)
  const beforeContent = before.extractContents()
  const after = document.createRange()
  after.selectNodeContents(link)
  after.setStartAfter(image)
  const afterContent = after.extractContents()
  const fragments: Node[] = []
  for (const content of [beforeContent, afterContent]) {
    const copy = link.cloneNode(false) as HTMLAnchorElement
    copy.append(content)
    // 被图片拆开的空强调标签不构成额外的键盘入口。
    if (copy.textContent?.trim() || copy.querySelector('img')) fragments.push(copy)
    if (content === beforeContent) fragments.push(target)
  }
  link.replaceWith(...fragments)
}

function collectImages() {
  const root = props.root
  if (!root || (lastRoot === root && lastHtml === props.html)) return
  lastRoot = root
  lastHtml = props.html
  generation++
  images.value = [...root.querySelectorAll<HTMLImageElement>('img')].map((image, index) => {
    const attrs = Object.fromEntries(
      ['src', 'alt', 'title', 'width', 'height', 'srcset', 'sizes', 'loading', 'decoding', 'referrerpolicy']
        .filter((name) => image.hasAttribute(name))
        .map((name) => [name, image.getAttribute(name)!]),
    )
    // 水合前已经显示的图片沿用固有尺寸，新组件接管时不让缓存图片短暂塌陷。
    if (!attrs.width && !attrs.height && image.naturalWidth && image.naturalHeight) {
      attrs.width = String(image.naturalWidth)
      attrs.height = String(image.naturalHeight)
    }
    const target = document.createElement('span')
    target.className = 'markdown-image'
    const preview = image.closest<HTMLButtonElement>('button[data-article-image]')
    const link = image.closest<HTMLAnchorElement>('a')
    const item: MarkdownImage = {
      key: `${generation}-${index}`,
      target: markRaw(target),
      attrs,
      failed: false,
    }
    if (preview) {
      item.preview = preview.getAttribute('aria-label') || t('layout.markdownImages.preview')
      preview.replaceWith(target)
    } else if (link) {
      // 只从已经净化的原始链接复制导航属性，不引入原始 Markdown HTML。
      item.link = Object.fromEntries(
        ['href', 'target', 'rel', 'title']
          .filter((name) => link.hasAttribute(name))
          .map((name) => [name, link.getAttribute(name)!]),
      )
      splitLink(link, image, target)
    } else image.replaceWith(target)
    return item
  })
}

onMounted(collectImages)
watch(() => [props.root, props.html], collectImages, { flush: 'post' })
</script>

<style lang="scss">
// 挂载位位于 v-html 内，使用限定类名而非依赖父组件的 scoped 属性。
.markdown-image {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
  line-height: 0;
  border-radius: 0.5rem;
}

.markdown-image__content {
  display: block;
  max-width: 100%;
  height: auto;
  // 未知尺寸先留后备比例，图片就绪后 auto 沿用真实比例，不拉伸小图或徽章。
  aspect-ratio: auto 3 / 2;
  border-radius: inherit;
}

span.markdown-image > :is(a, button).markdown-image__action {
  position: absolute;
  inset: 0;
  display: block;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: var(--interaction-cursor, zoom-in);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  &:is(a) {
    cursor: var(--interaction-cursor, pointer);
  }
}
</style>
