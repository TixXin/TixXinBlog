<!--
  @file CommentReplyForm.vue
  @description 文章评论博主回复表单：正文输入、快捷提交、离开确认与焦点恢复
  @author TixXin
  @since 2026-10-21
-->
<template>
  <form class="admin-comments__reply" @submit.prevent="$emit('submit')">
    <label>
      {{ t('admin-content.comments.reply.label', { author: target.author }) }}
      <textarea
        ref="replyInput"
        :value="modelValue"
        :aria-label="t('admin-content.comments.reply.input')"
        maxlength="1000"
        rows="3"
        required
        :disabled="working"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <p>{{ t('admin-content.comments.reply.post', { title: target.postTitle }) }}</p>
    <blockquote>{{ target.content }}</blockquote>
    <button :aria-busy="submitting" type="submit" :disabled="working || !modelValue.trim()">
      {{ t('admin-content.comments.reply.submit') }}
    </button>
    <button type="button" :disabled="working" @click="$emit('cancel')">
      {{ t('admin-content.comments.reply.cancel') }}
    </button>
  </form>
</template>

<script setup lang="ts">
export interface CommentReplyTarget {
  author: string
  postTitle: string
  content: string
}

withDefaults(
  defineProps<{
    target: CommentReplyTarget
    modelValue: string
    working?: boolean
    submitting?: boolean
  }>(),
  {
    working: false,
    submitting: false,
  },
)

defineEmits<{
  submit: []
  cancel: []
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const replyInput = ref<HTMLTextAreaElement | null>(null)

function focus() {
  replyInput.value?.focus()
}

defineExpose({
  focus,
})
</script>

<style scoped>
.admin-comments__reply {
  min-width: 0;
  padding: 1rem 1.125rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  overflow-wrap: anywhere;
}
.admin-comments__reply textarea {
  display: block;
  width: 100%;
}
</style>
