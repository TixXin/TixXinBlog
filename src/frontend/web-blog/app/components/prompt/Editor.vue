<!-- @file Editor.vue @description 与博客同主题的页内提示词编辑器，效果图和文字并排核对 -->
<template>
  <Teleport to="body">
    <div
      ref="dialog"
      class="prompt-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-editor-title"
      tabindex="-1"
      @click.self="close"
    >
      <section class="prompt-editor__panel">
        <header class="prompt-editor__header">
          <div>
            <p>灵感图鉴 / {{ editor.id.value ? '编辑' : '新建' }}</p>
            <h2 id="prompt-editor-title">{{ editor.id.value ? '打磨这份灵感' : '分享一份新灵感' }}</h2>
          </div>
          <button
            type="button"
            class="prompt-editor__close"
            aria-label="关闭提示词编辑器"
            :disabled="editor.saving.value"
            @click="close"
          >
            <Icon name="lucide:x" size="20" />
          </button>
        </header>
        <div v-if="mediaOpen" class="prompt-editor__library">
          <button type="button" class="prompt-editor__secondary" @click="closeMedia">
            <Icon name="lucide:arrow-left" size="16" />返回提示词编辑</button
          ><AdminMediaWorkspace selectable @selected="selectMedia" @busy="mediaBusy = $event" />
        </div>
        <template v-else>
          <div ref="feedback" class="prompt-editor__feedback" tabindex="-1">
            <p v-if="editor.loading.value">正在读取提示词…</p>
            <p v-if="editor.error.value" role="alert">
              {{ editor.error.value
              }}<button v-if="!editor.ready.value" type="button" :disabled="editor.loading.value" @click="editor.load">
                重新读取
              </button>
            </p>
            <p v-if="editor.notice.value">{{ editor.notice.value }}</p>
            <p v-if="editor.localError.value" role="alert">
              {{ editor.localError.value }}<button type="button" @click="editor.persist">重试保存副本</button>
            </p>
            <section v-if="editor.recovery.value" class="prompt-editor__recovery">
              <h3>发现未保存的输入</h3>
              <p>{{ editor.recovery.value.form.title || '未命名灵感' }} · {{ editor.recovery.value.savedAt }}</p>
              <details>
                <summary>查看恢复内容</summary>
                <dl class="prompt-editor__comparison">
                  <div>
                    <dt>完整提示词</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.recovery.value.form.prompt || '未填写' }}
                    </dd>
                  </div>
                  <div>
                    <dt>创作笔记</dt>
                    <dd class="prompt-editor__long-text" tabindex="0">
                      {{ editor.recovery.value.form.description || '未填写' }}
                    </dd>
                  </div>
                  <div>
                    <dt>负面提示词</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.recovery.value.form.negativePrompt || '未填写' }}
                    </dd>
                  </div>
                  <div>
                    <dt>模型与标签</dt>
                    <dd>
                      {{ editor.recovery.value.form.model || '模型未标注' }} ·
                      {{ editor.recovery.value.form.tags.join(' / ') || '未设置标签' }}
                    </dd>
                  </div>
                  <div>
                    <dt>图片来源</dt>
                    <dd>
                      {{
                        editor.recovery.value.form.imageSource === 'external'
                          ? editor.recovery.value.form.externalImageUrl || '外部地址未填写'
                          : editor.recovery.value.form.mediaId
                            ? '已选择媒体库图片'
                            : '尚未选择图片'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>图片描述</dt>
                    <dd>{{ editor.recovery.value.form.imageAlt || '未填写' }}</dd>
                  </div>
                  <div>
                    <dt>创作来源</dt>
                    <dd>{{ editor.recovery.value.form.sourceUrl || '未填写' }}</dd>
                  </div>
                </dl>
              </details>
              <button
                type="button"
                :disabled="!editor.ready.value || editor.saving.value"
                @click="editor.restoreRecovery"
              >
                恢复输入</button
              ><button type="button" :disabled="editor.saving.value" @click="editor.discardRecovery">移除副本</button>
            </section>
            <section v-if="editor.serverVersion.value" class="prompt-editor__recovery">
              <h3>服务器已有版本 {{ editor.serverVersion.value.revision }}</h3>
              <details open>
                <summary>
                  {{ editor.serverVersion.value.title }} ·
                  {{ editor.serverVersion.value.status === 'published' ? '已公开' : '草稿' }}
                </summary>
                <p>以下是服务器上的最新内容。当前表单仍保留你的输入，请比较后再合并保存。</p>
                <dl class="prompt-editor__comparison">
                  <div>
                    <dt>完整提示词</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.serverVersion.value.prompt }}
                    </dd>
                  </div>
                  <div>
                    <dt>创作笔记</dt>
                    <dd class="prompt-editor__long-text" tabindex="0">
                      {{ editor.serverVersion.value.description || '未填写' }}
                    </dd>
                  </div>
                  <div>
                    <dt>负面提示词</dt>
                    <dd class="prompt-editor__long-text" tabindex="0" dir="auto">
                      {{ editor.serverVersion.value.negativePrompt || '未填写' }}
                    </dd>
                  </div>
                  <div>
                    <dt>模型与标签</dt>
                    <dd>
                      {{ editor.serverVersion.value.model || '模型未标注' }} ·
                      {{ editor.serverVersion.value.tags.join(' / ') || '未设置标签' }}
                    </dd>
                  </div>
                  <div>
                    <dt>效果图片</dt>
                    <dd>
                      <CommonImageFrame
                        class="prompt-editor__comparison-image"
                        :src="editor.serverVersion.value.imageUrl"
                        :alt="editor.serverVersion.value.imageAlt || editor.serverVersion.value.title"
                        :width="editor.serverVersion.value.width || undefined"
                        :height="editor.serverVersion.value.height || undefined"
                        fit="contain"
                      /><span>{{ editor.serverVersion.value.mediaId ? '媒体库图片' : '外部图片' }}</span
                      ><a :href="editor.serverVersion.value.imageUrl" target="_blank" rel="noopener noreferrer"
                        >打开服务器效果图<Icon name="lucide:external-link" size="13"
                      /></a>
                    </dd>
                  </div>
                  <div>
                    <dt>图片描述</dt>
                    <dd>{{ editor.serverVersion.value.imageAlt || '未填写' }}</dd>
                  </div>
                  <div>
                    <dt>创作来源</dt>
                    <dd>
                      <a
                        v-if="editor.serverVersion.value.sourceUrl"
                        :href="editor.serverVersion.value.sourceUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ editor.serverVersion.value.sourceUrl }}<Icon name="lucide:external-link" size="13" /></a
                      ><span v-else>未填写</span>
                    </dd>
                  </div>
                </dl>
              </details>
              <button type="button" :disabled="editor.saving.value" @click="editor.merge">
                保留当前输入，按最新版本合并
              </button>
            </section>
          </div>
          <form
            ref="formElement"
            class="prompt-editor__form"
            :aria-busy="editor.saving.value"
            novalidate
            @submit.prevent="submit(form.status)"
          >
            <fieldset :disabled="!editor.ready.value || editor.loading.value || editor.saving.value">
              <div class="prompt-editor__columns">
                <section class="prompt-editor__visual">
                  <h3>先让画面说话</h3>
                  <p>放入效果图，让灵感一眼可见。</p>
                  <div class="prompt-editor__preview">
                    <CommonImageFrame
                      v-if="previewUrl"
                      :src="previewUrl"
                      :alt="form.imageAlt || form.title || '效果图片预览'"
                      fit="contain"
                      loading="eager"
                    />
                    <div v-else class="prompt-editor__placeholder">
                      <Icon name="lucide:image-plus" size="30" /><span>为提示词挑选一张效果图</span>
                    </div>
                  </div>
                  <div class="prompt-editor__source" role="group" aria-label="效果图片来源">
                    <button
                      type="button"
                      :aria-pressed="form.imageSource === 'media'"
                      @click="form.imageSource = 'media'"
                    >
                      媒体库</button
                    ><button
                      type="button"
                      :aria-pressed="form.imageSource === 'external'"
                      @click="form.imageSource = 'external'"
                    >
                      图片链接
                    </button>
                  </div>
                  <button
                    v-if="form.imageSource === 'media'"
                    ref="mediaButton"
                    v-bind="fieldAttributes('mediaId')"
                    type="button"
                    class="prompt-editor__secondary"
                    @click="mediaOpen = true"
                  >
                    <Icon name="lucide:upload" size="16" />{{
                      form.mediaId ? '更换或上传图片' : '选择或上传图片'
                    }}</button
                  ><small
                    v-if="attempted && fieldErrors.mediaId"
                    id="prompt-editor-mediaId-error"
                    class="prompt-editor__field-error"
                    >{{ fieldErrors.mediaId }}</small
                  ><label v-if="form.imageSource === 'external'"
                    >外部图片地址<input
                      v-model="form.externalImageUrl"
                      v-bind="fieldAttributes('externalImageUrl')"
                      type="url"
                      maxlength="2048"
                      placeholder="https://…"
                    /><small>使用图片直链；浏览器直接加载，服务器不会抓取。</small
                    ><small
                      v-if="attempted && fieldErrors.externalImageUrl"
                      id="prompt-editor-externalImageUrl-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.externalImageUrl }}</small
                    ></label
                  ><label
                    >图片描述<input
                      v-model="form.imageAlt"
                      v-bind="fieldAttributes('imageAlt')"
                      maxlength="240"
                      placeholder="为无法看见图片的读者描述画面"
                    /><small
                      v-if="attempted && fieldErrors.imageAlt"
                      id="prompt-editor-imageAlt-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.imageAlt }}</small
                    ></label
                  >
                </section>
                <section class="prompt-editor__writing">
                  <label
                    >灵感标题<span class="prompt-editor__required">必填</span
                    ><input
                      v-model="form.title"
                      v-bind="fieldAttributes('title')"
                      required
                      maxlength="160"
                      placeholder="给这幅画面起个名字"
                    /><small id="prompt-editor-title-count" class="prompt-editor__count"
                      >{{ form.title.length }} / {{ promptFieldLimits.title }}</small
                    ><small
                      v-if="attempted && fieldErrors.title"
                      id="prompt-editor-title-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.title }}</small
                    ></label
                  ><label
                    >一句创作笔记<textarea
                      v-model="form.description"
                      v-bind="fieldAttributes('description')"
                      rows="2"
                      maxlength="2000"
                      placeholder="构图的巧思、尝试的方向，或这张图的故事"
                    /><small
                      v-if="attempted && fieldErrors.description"
                      id="prompt-editor-description-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.description }}</small
                    ></label
                  ><label
                    >完整提示词<span class="prompt-editor__required">必填</span
                    ><textarea
                      v-model="form.prompt"
                      v-bind="fieldAttributes('prompt')"
                      class="prompt-editor__prompt"
                      required
                      rows="8"
                      maxlength="30000"
                      placeholder="描述主体、场景、光线与质感，保留可以直接使用的完整提示词…"
                      dir="auto"
                    /><small id="prompt-editor-prompt-count" class="prompt-editor__count"
                      >{{ form.prompt.length }} / {{ promptFieldLimits.prompt }}</small
                    ><small
                      v-if="attempted && fieldErrors.prompt"
                      id="prompt-editor-prompt-error"
                      class="prompt-editor__field-error"
                      >{{ fieldErrors.prompt }}</small
                    >
                  </label>
                  <div class="prompt-editor__row">
                    <label
                      >生成模型<input
                        v-model="form.model"
                        v-bind="fieldAttributes('model')"
                        list="prompt-editor-models"
                        maxlength="80"
                        placeholder="例如 Midjourney"
                      /><datalist id="prompt-editor-models">
                        <option v-for="model in models" :key="model" :value="model" /></datalist
                      ><small
                        v-if="attempted && fieldErrors.model"
                        id="prompt-editor-model-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.model }}</small
                      ></label
                    ><label
                      >风格标签<input
                        v-model="tagsInput"
                        v-bind="fieldAttributes('tags')"
                        placeholder="用逗号分隔，如 摄影，静物"
                        maxlength="395"
                      /><small id="prompt-editor-tags-count">{{ form.tags.length }} / 12 个标签，每个 32 字以内</small
                      ><small
                        v-if="attempted && fieldErrors.tags"
                        id="prompt-editor-tags-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.tags }}</small
                      ></label
                    >
                  </div>
                  <details ref="optionalDetails" class="prompt-editor__optional">
                    <summary>更多细节：负面提示词与来源</summary>
                    <label
                      >负面提示词<textarea
                        v-model="form.negativePrompt"
                        v-bind="fieldAttributes('negativePrompt')"
                        rows="3"
                        maxlength="10000"
                        placeholder="可选，描述希望排除的内容"
                        dir="auto"
                      /><small id="prompt-editor-negativePrompt-count" class="prompt-editor__count"
                        >{{ form.negativePrompt.length }} / {{ promptFieldLimits.negativePrompt }}</small
                      ><small
                        v-if="attempted && fieldErrors.negativePrompt"
                        id="prompt-editor-negativePrompt-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.negativePrompt }}</small
                      ></label
                    ><label
                      >创作来源<input
                        v-model="form.sourceUrl"
                        v-bind="fieldAttributes('sourceUrl')"
                        type="url"
                        maxlength="2048"
                        placeholder="可选，原作品或参考链接"
                      /><small
                        v-if="attempted && fieldErrors.sourceUrl"
                        id="prompt-editor-sourceUrl-error"
                        class="prompt-editor__field-error"
                        >{{ fieldErrors.sourceUrl }}</small
                      ></label
                    >
                  </details>
                </section>
              </div>
            </fieldset>
            <footer class="prompt-editor__footer">
              <div class="prompt-editor__save-state">
                <p
                  role="status"
                  :class="{ 'prompt-editor__save-error': editor.error.value || editor.localError.value }"
                >
                  <Icon
                    :name="editor.error.value || editor.localError.value ? 'lucide:circle-alert' : 'lucide:circle-dot'"
                    size="13"
                  />{{ footerStatus }}
                </p>
                <small v-if="form.status === 'published'">转为草稿后，访客将无法查看这份灵感。</small>
              </div>
              <div class="prompt-editor__actions">
                <button
                  type="button"
                  class="prompt-editor__secondary"
                  :disabled="!editor.ready.value || editor.loading.value || editor.saving.value"
                  @click="submit('draft')"
                >
                  {{
                    editor.saving.value ? '正在保存…' : form.status === 'published' ? '转为草稿' : '保存草稿'
                  }}</button
                ><button
                  type="button"
                  class="prompt-editor__primary"
                  :disabled="!editor.ready.value || editor.loading.value || editor.saving.value"
                  @click="submit('published')"
                >
                  <Icon name="lucide:arrow-up-right" size="16" />{{
                    editor.saving.value ? '正在保存…' : form.status === 'published' ? '保存并更新' : '发布灵感'
                  }}
                </button>
              </div>
            </footer>
          </form>
        </template>
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { ManagedPrompt, PromptForm, PromptStatus } from '~/features/prompt/types'
import { promptFieldLimits, promptFormErrors } from '~/features/prompt/editor'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{ id: number | null; models: string[] }>()
const emit = defineEmits<{ close: []; saved: [item: ManagedPrompt] }>()
const editor = usePromptEditor(props.id, (item) => emit('saved', item)),
  form = editor.form
const dialog = ref<HTMLElement | null>(null),
  mediaOpen = ref(false),
  mediaBusy = ref(false)
const formElement = ref<HTMLFormElement | null>(null),
  feedback = ref<HTMLElement | null>(null),
  mediaButton = ref<HTMLButtonElement | null>(null),
  optionalDetails = ref<HTMLDetailsElement | null>(null)
const attempted = ref(false),
  fieldErrors = computed(() => promptFormErrors(form))
const footerStatus = computed(() => {
  if (editor.loading.value) return '正在读取提示词…'
  if (editor.saving.value) return editor.pendingCreate.value ? '正在核查并保存提交…' : '正在保存…'
  if (editor.serverVersion.value) return '检测到版本冲突，请先核对上方服务器内容。'
  if (editor.error.value) return editor.error.value
  if (editor.localError.value) return editor.localError.value
  if (editor.pendingCreate.value) return '上次提交结果待核查，再次保存会先确认是否成功。'
  if (editor.dirty.value) return '有未保存的修改'
  return editor.notice.value || (editor.id.value ? '修改已保存' : '每一张图，都是一个新起点')
})
const fieldLabels: Partial<Record<keyof PromptForm, string>> = {
  title: '灵感标题',
  prompt: '完整提示词',
  description: '一句创作笔记',
  negativePrompt: '负面提示词',
  model: '生成模型',
  tags: '风格标签',
  externalImageUrl: '外部图片地址',
  imageAlt: '图片描述',
  sourceUrl: '创作来源',
}
function fieldAttributes(field: keyof PromptForm) {
  const descriptions = [
    ['title', 'prompt', 'negativePrompt', 'tags'].includes(field) ? `prompt-editor-${field}-count` : '',
    attempted.value && fieldErrors.value[field] ? `prompt-editor-${field}-error` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    'data-prompt-field': field,
    'aria-label': fieldLabels[field],
    'aria-invalid': (attempted.value && !!fieldErrors.value[field]) || undefined,
    'aria-describedby': descriptions || undefined,
  }
}
async function submit(status: PromptStatus) {
  attempted.value = true
  await editor.save(status)
  const first = Object.keys(fieldErrors.value)[0] as keyof PromptForm | undefined
  if (!first) {
    if (editor.error.value) {
      await nextTick()
      feedback.value?.focus()
    }
    return
  }
  if (['negativePrompt', 'sourceUrl'].includes(first) && optionalDetails.value) optionalDetails.value.open = true
  await nextTick()
  formElement.value?.querySelector<HTMLElement>(`[data-prompt-field="${first}"]`)?.focus()
}
async function returnFromMedia() {
  mediaOpen.value = false
  await nextTick()
  mediaButton.value?.focus({ preventScroll: true })
}
const previewUrl = computed(() =>
  form.imageSource === 'external' ? form.externalImageUrl : form.mediaId ? `/api/v1/media/${form.mediaId}.webp` : '',
)
const parseTags = (value: string) => [
  ...new Set(
    value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
]
const tagsInput = ref(form.tags.join('，'))
watch(tagsInput, (value) => {
  form.tags = parseTags(value)
})
watch(
  () => form.tags,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(parseTags(tagsInput.value))) tagsInput.value = value.join('，')
  },
)
function closeMedia() {
  if (mediaBusy.value && !window.confirm('仍有上传或未保存的媒体输入，确定返回编辑吗？已上传资源会保留。')) return
  void returnFromMedia()
}
function close() {
  if (mediaOpen.value) {
    closeMedia()
    return
  }
  if (editor.canClose()) emit('close')
}
function selectMedia(asset: MediaAsset) {
  form.mediaId = asset.id
  form.imageAlt ||= asset.alt
  void returnFromMedia()
}
useModalFocus(true, dialog, { close })
</script>
<style scoped lang="scss">
.prompt-editor {
  position: fixed;
  inset: 0;
  z-index: 110;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 20, 0.65);
  backdrop-filter: blur(8px);
}
.prompt-editor__panel {
  width: min(1050px, 100%);
  max-height: 92dvh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  color: var(--text-main);
  background: var(--surface-1);
}
.prompt-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
}
.prompt-editor__header p {
  font-size: 0.7rem;
  color: var(--text-soft);
  letter-spacing: 0.1em;
}
h2 {
  margin-top: 0.35rem;
  font-size: 1.3rem;
  font-weight: 600;
}
h3 {
  font-size: 0.875rem;
  font-weight: 600;
}
.prompt-editor__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--text-main);
  border-radius: 50%;
  background: var(--surface-2);
}
.prompt-editor__feedback {
  padding: 0 2rem;
  font-size: 0.8125rem;
  line-height: 1.8;
}
.prompt-editor__feedback > p {
  margin-top: 1rem;
}
.prompt-editor__feedback:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.prompt-editor__feedback button {
  color: var(--accent-text);
  padding: 0.5rem;
  min-height: 40px;
}
.prompt-editor__recovery {
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
}
.prompt-editor__recovery p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 12rem;
  overflow: auto;
}

.prompt-editor__comparison {
  display: grid;
  gap: 0.85rem;
  margin: 1rem 0;
}
.prompt-editor__comparison dt {
  color: var(--text-soft);
  font-size: 0.72rem;
  margin-bottom: 0.3rem;
}
.prompt-editor__comparison dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.prompt-editor__comparison a {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-text);
  margin-left: 0.75rem;
  max-width: 100%;
}
.prompt-editor__comparison-image {
  max-width: 240px;
  max-height: 180px;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
}
.prompt-editor__long-text {
  max-height: 12rem;
  overflow: auto;
  padding-right: 0.5rem;
}
.prompt-editor__long-text:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.prompt-editor__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.prompt-editor__field-error {
  color: var(--danger);
}
[aria-invalid='true'] {
  border-color: var(--danger);
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.prompt-editor__columns {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 2rem;
  padding: 1.5rem 2rem;
}
.prompt-editor__visual > p {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin: 0.4rem 0 1rem;
}
.prompt-editor__preview {
  min-height: 180px;
  border-radius: 0.7rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
}
.prompt-editor__preview :deep(.image-frame) {
  height: 240px;
}
.prompt-editor__placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
  justify-content: center;
  min-height: 230px;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.prompt-editor__source {
  display: flex;
  gap: 0.25rem;
  margin: 1rem 0 0.6rem;
}
.prompt-editor__source button {
  padding: 0.55rem 0.8rem;
  min-height: 40px;
  font-size: 0.75rem;
  color: var(--text-soft);
  border-radius: 0.4rem;
}
.prompt-editor__source button[aria-pressed='true'] {
  background: var(--surface-2);
  color: var(--text-main);
}
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
input,
textarea {
  display: block;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.7rem 0.8rem;
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 400;
  margin-top: 0.45rem;
  line-height: 1.75;
}
textarea {
  resize: vertical;
}
input::placeholder,
textarea::placeholder {
  color: var(--text-soft);
  opacity: 0.85;
}
input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
small {
  display: block;
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 400;
  margin-top: 0.4rem;
  line-height: 1.6;
}
.prompt-editor__required {
  color: var(--text-soft);
  font-size: 0.65rem;
  margin-left: 0.5rem;
  font-weight: 400;
}
.prompt-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.prompt-editor__optional {
  font-size: 0.75rem;
  color: var(--text-soft);
}
summary {
  cursor: var(--interaction-cursor, pointer);
  padding-block: 0.5rem;
}
.prompt-editor__optional label {
  margin-top: 0.5rem;
  color: var(--text-main);
}
.prompt-editor__footer {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  background: var(--surface-1);
  padding: 1rem 2rem;
  border-top: 1px solid var(--border);
}
.prompt-editor__footer p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.prompt-editor__footer p :deep(svg) {
  flex-shrink: 0;
}
.prompt-editor__save-state {
  flex: 1 1 15rem;
  min-width: 0;
}
.prompt-editor__footer .prompt-editor__save-error {
  color: var(--danger);
}
.prompt-editor__actions {
  display: flex;
  gap: 0.6rem;
}
.prompt-editor__secondary,
.prompt-editor__primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.75rem;
}
.prompt-editor__secondary {
  background: var(--surface-2);
  color: var(--text-main);
}
.prompt-editor__primary {
  background: var(--accent-action);
  color: #fff;
  border-color: var(--accent-action);
}
.prompt-editor__visual > .prompt-editor__secondary {
  margin-bottom: 1rem;
  width: 100%;
  justify-content: center;
}
button:disabled,
fieldset:disabled {
  opacity: 0.6;
}
.prompt-editor__library {
  padding: 1.5rem 2rem;
}
@media (max-width: 720px) {
  .prompt-editor {
    padding: 0.6rem;
  }
  .prompt-editor__panel {
    max-height: 96dvh;
  }
  .prompt-editor__columns {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1rem;
  }
  .prompt-editor__header,
  .prompt-editor__footer {
    padding: 1rem;
  }
  .prompt-editor__feedback {
    padding: 0 1rem;
  }
  .prompt-editor__preview :deep(.image-frame) {
    height: 200px;
  }
  .prompt-editor__row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .prompt-editor__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
