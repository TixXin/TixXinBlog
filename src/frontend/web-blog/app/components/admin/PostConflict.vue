<!--
  @file PostConflict.vue
  @description 显示本地与服务器完整内容，必须显式比较后选择，不自动覆盖。
-->
<template>
  <section class="post-conflict" aria-label="文章版本冲突">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div class="post-conflict__columns">
      <section v-for="item in versions" :key="item.label">
        <h3>{{ item.label }} · 版本 {{ item.draft.revision ?? '未知' }}</h3>
        <p>标题：{{ item.draft.title }}</p>
        <p>摘要：{{ item.draft.summary }}</p>
        <p>专栏：{{ item.draft.folder }} · 标签：{{ item.draft.tags.join('、') }}</p>
        <p>封面：{{ item.draft.cover || '无' }}</p>
        <p>地址：{{ item.draft.slug || '数字编号' }} · 封面描述：{{ item.draft.coverAlt || '未设置' }}</p>
        <p>SEO 标题：{{ item.draft.seoTitle || '使用文章标题' }}</p>
        <p>
          SEO 描述：{{ item.draft.seoDescription || '使用摘要' }} · 收录：{{
            item.draft.seoNoindex ? '不收录' : '允许'
          }}
        </p>
        <p>
          状态：{{ item.draft.status }} · 阅读分钟：{{ item.draft.readTimeMinutes }} · 置顶：{{
            item.draft.pinned ? '是' : '否'
          }}
        </p>
        <label>{{ item.label }}正文<textarea readonly rows="12" :value="item.draft.contentRaw" /></label>
      </section>
    </div>
    <details class="post-conflict__diff">
      <summary>查看正文差异：移除 {{ difference.removed.length }} 行，新增 {{ difference.added.length }} 行</summary>
      <p>从{{ serverLabel }}到{{ localLabel }}；中间变化区域完整显示，前后各保留最多三行上下文。</p>
      <pre>{{ difference.prefix.slice(-3).join('\n') }}</pre>
      <pre v-if="difference.removed.length" class="post-conflict__removed" aria-label="移除的正文">{{
        difference.removed.join('\n')
      }}</pre>
      <pre v-if="difference.added.length" class="post-conflict__added" aria-label="新增的正文">{{
        difference.added.join('\n')
      }}</pre>
      <pre>{{ difference.suffix.slice(0, 3).join('\n') }}</pre>
    </details>
    <button type="button" @click="$emit('useServer')">{{ useServerLabel }}</button
    ><button type="button" @click="$emit('keepLocal')">{{ keepLocalLabel }}</button>
  </section>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { postDifference } from '~/utils/postDifference'
const props = withDefaults(
  defineProps<{
    local: AdminPostDraft
    server: AdminPostDraft
    title?: string
    description?: string
    localLabel?: string
    serverLabel?: string
    useServerLabel?: string
    keepLocalLabel?: string
  }>(),
  {
    title: '服务器已有更新',
    description: '当前输入仍保留。请比较两份内容，选择载入服务器版本，或保留当前输入继续合并。',
    localLabel: '当前输入',
    serverLabel: '服务器',
    useServerLabel: '载入服务器版本并暂存当前输入',
    keepLocalLabel: '保留当前输入，基于最新版本继续合并',
  },
)
defineEmits<{ useServer: []; keepLocal: [] }>()
const difference = computed(() => postDifference(props.server.contentRaw, props.local.contentRaw))
const versions = computed(() => [
  { label: props.localLabel, draft: props.local },
  { label: props.serverLabel, draft: props.server },
])
</script>
<style scoped lang="scss">
.post-conflict {
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1rem;
  margin: 1rem 0;
  background: var(--surface-2);
  overflow-wrap: anywhere;
}
.post-conflict__diff {
  margin-top: 1rem;
}
.post-conflict__diff pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 20rem;
  overflow: auto;
  padding: 0.5rem;
}
.post-conflict__removed {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
.post-conflict__added {
  border-left: 3px solid #22c55e;
  background: rgba(34, 197, 94, 0.08);
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
}
h3 {
  margin: 1rem 0;
}
.post-conflict__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
textarea {
  width: 100%;
  color: var(--text-main);
  background: var(--surface-1);
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
button {
  padding: 0.65rem;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
}
@media (max-width: 700px) {
  .post-conflict__columns {
    grid-template-columns: 1fr;
  }
}
</style>
