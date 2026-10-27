<!--
  @file PostPublishDialog.vue
  @description 文章发布前检查：标题、地址、分类、收录、关联与摘要核对，封面与正文图片缺失替代文本的警告
-->
<template>
  <dialog
    ref="dialog"
    class="post-editor__publish"
    aria-labelledby="publish-check-title"
    :aria-describedby="hasMissingAlt ? 'publish-alt-description' : undefined"
    @close="emit('close')"
  >
    <!-- 打开时焦点落在标题：内容超出高度时默认聚焦底部按钮会把标题和摘要滚出视口 -->
    <h2 id="publish-check-title" tabindex="-1" autofocus>{{ $t('admin-content.postEditor.publishCheck') }}</h2>
    <p>
      {{
        draft.status === 'published'
          ? $t('admin-content.postEditor.publishUpdate')
          : $t('admin-content.postEditor.publishNew')
      }}
    </p>
    <dl>
      <dt>{{ $t('admin-content.postEditor.checkTitle') }}</dt>
      <dd>{{ draft.title }}</dd>
      <dt>{{ $t('admin-content.postEditor.checkAddress') }}</dt>
      <dd>{{ addressPreview }}</dd>
      <dt>{{ $t('admin-content.postEditor.checkTaxonomy') }}</dt>
      <dd>
        {{ draft.folder }} ·
        {{ selectedTags.join($t('admin-content.postEditor.tagSeparator')) || $t('admin-content.postEditor.noTags') }}
      </dd>
      <dt>{{ $t('admin-content.postEditor.checkIndexing') }}</dt>
      <dd>
        {{ draft.seoNoindex ? $t('admin-content.postEditor.indexingOff') : $t('admin-content.postEditor.indexingOn') }}
      </dd>
      <dt>{{ $t('admin-content.postEditor.checkRelations') }}</dt>
      <dd>{{ contentRelationSummary(draft.relatedContent, $t) }}</dd>
      <dt>{{ $t('admin-content.postEditor.checkSummary') }}</dt>
      <dd>{{ draft.seoDescription || draft.summary || suggestedSummary(draft.contentRaw) }}</dd>
    </dl>
    <p v-if="!draft.cover">{{ $t('admin-content.postEditor.noCover') }}</p>
    <p v-if="coverFailed">{{ $t('admin-content.postEditor.coverCheckFailed') }}</p>
    <section v-if="hasMissingAlt" class="post-editor__alt-warnings" aria-labelledby="publish-alt-title">
      <h3 id="publish-alt-title">{{ $t('admin-content.postEditor.altWarning') }}</h3>
      <p id="publish-alt-description">{{ $t('admin-content.postEditor.altDescription') }}</p>
      <ul>
        <li v-if="missingCoverAlt">{{ $t('admin-content.postEditor.altCover') }}</li>
        <li v-for="image in missingImageAlts" :key="image.imageNumber">
          {{ $t('admin-content.postEditor.altImage', { image: image.imageNumber, line: image.line }) }}
        </li>
      </ul>
    </section>
    <p>{{ $t('admin-content.postEditor.slugCheckHint') }}</p>
    <button type="button" :disabled="pending" @click="dialog?.close()">
      {{ $t('admin-content.postEditor.backToEdit') }}</button
    ><button type="button" :disabled="pending" @click="confirm">
      {{ hasMissingAlt ? $t('admin-content.postEditor.publishAnyway') : $t('admin-content.postEditor.confirmPublish') }}
    </button>
  </dialog>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { contentRelationSummary } from '~/features/content-relation/editor'
import { missingImageAltPositions, suggestedSummary } from '~/utils/postPublishing'

const props = defineProps<{
  draft: AdminPostDraft
  pending: boolean
  addressPreview: string
  selectedTags: string[]
  coverFailed: boolean
}>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const missingImageAlts = computed(() => missingImageAltPositions(props.draft.contentRaw))
const missingCoverAlt = computed(() => Boolean(props.draft.cover.trim() && !props.draft.coverAlt?.trim()))
const hasMissingAlt = computed(() => missingCoverAlt.value || missingImageAlts.value.length > 0)
function confirm() {
  if (props.pending || !dialog.value?.open) return
  dialog.value.close()
  emit('confirm')
}
defineExpose({ showModal: () => dialog.value?.showModal() })
</script>
<style scoped lang="scss">
@use '~/assets/styles/post-editor' as post;

@include post.editor;
</style>
