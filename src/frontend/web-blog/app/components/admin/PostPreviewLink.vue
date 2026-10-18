<!-- @file PostPreviewLink.vue @description 草稿预览链接的分享说明、有效期与可访问复制入口。 -->
<template>
  <section class="post-preview-link" :aria-labelledby="titleId">
    <h2 :id="titleId">分享草稿预览</h2>
    <p :id="descriptionId">
      链接有效期为 7 天，持有链接的人无需登录即可查看。修改文章后旧链接仍有效直到过期，并显示最新保存的内容。
    </p>
    <p>文章发布、归档或移入回收站后不可预览。</p>
    <p v-if="!saved">请先保存草稿，再生成预览链接。</p>
    <p v-else-if="!available">仅未删除的草稿可生成预览链接，请先保存为草稿。</p>
    <p v-if="dirty">当前有未保存的修改，预览只显示服务器已保存的内容；生成链接不会保存当前输入。</p>
    <div class="post-preview-link__actions">
      <CommonTooltip content="仅为已保存的草稿生成 7 天预览链接，不会保存当前输入">
        <button
          type="button"
          :disabled="!available || busy || pending"
          :aria-busy="pending"
          :aria-describedby="descriptionId"
          @click="$emit('generate')"
        >
          <Icon name="lucide:link" size="16" aria-hidden="true" />
          {{ pending ? '正在生成…' : url ? '生成新预览链接' : '生成预览链接' }}
        </button>
      </CommonTooltip>
      <template v-if="url">
        <CommonTooltip content="复制完整预览链接，请仅分享给可信任的人">
          <button type="button" :disabled="busy || pending || copying" :aria-busy="copying" @click="$emit('copy')">
            <Icon name="lucide:copy" size="16" aria-hidden="true" />
            {{ copying ? '正在复制…' : '复制链接' }}
          </button>
        </CommonTooltip>
        <a :href="url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">在新标签页打开预览</a>
      </template>
    </div>
    <template v-if="url">
      <p>
        有效期至 <time :datetime="expiresAt">{{ expiresLabel }}</time
        >。重新生成不会撤销之前的链接。
      </p>
      <label>预览链接<input :value="url" type="url" readonly autocomplete="off" spellcheck="false" /></label>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
    <p role="status" aria-live="polite">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  saved: boolean
  available: boolean
  dirty: boolean
  busy: boolean
  pending: boolean
  copying: boolean
  url: string
  expiresAt: string
  error: string
  notice: string
}>()
defineEmits<{ generate: []; copy: [] }>()
const titleId = useId()
const descriptionId = useId()
const expiresLabel = computed(() =>
  props.expiresAt ? new Date(props.expiresAt).toLocaleString('zh-CN', { hour12: false }) : '',
)
</script>

<style scoped lang="scss">
.post-preview-link {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  p {
    margin: 0.5rem 0;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  label {
    display: grid;
    gap: 0.4rem;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.6rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  :is(button, a, input):focus-visible {
    outline: 2px solid var(--text-main);
    outline-offset: 3px;
  }
}

.post-preview-link__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
