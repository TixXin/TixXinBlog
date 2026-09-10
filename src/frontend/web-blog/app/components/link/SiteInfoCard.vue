<!-- @file SiteInfoCard.vue @description 真实本站友链资料与复制反馈，数据不可用时禁止复制默认资料 -->
<template>
  <section class="card site-info" aria-label="本站友链资料">
    <h3><Icon name="lucide:clipboard" size="16" />本站友链资料</h3>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || '正在读取本站资料'"
      compact
      @retry="$emit('retry')"
    />
    <dl v-if="info" class="site-info__list">
      <div v-for="item in info" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>
    <button type="button" :disabled="!ready || !info || pending || copying || !!error" @click="$emit('copy')">
      {{ copying ? '正在复制…' : '复制本站资料' }}
    </button>
    <button type="button" :disabled="!ready || pending" @click="$emit('retry')">刷新本站资料</button>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="copyError" role="alert">{{ copyError }}</p>
    <label v-if="copyError && retainedText"
      >待复制资料<textarea :value="retainedText" readonly rows="6" aria-label="待复制本站资料" />
    </label>
  </section>
</template>
<script setup lang="ts">
import type { SiteInfo } from '~/features/link/types'
defineProps<{
  info: SiteInfo[] | null
  ready: boolean
  pending: boolean
  error: string
  copying: boolean
  copyError: string
  notice: string
  retainedText: string
}>()
defineEmits<{ retry: []; copy: [] }>()
</script>
<style scoped lang="scss">
.site-info {
  padding: 1.25rem;
  overflow-wrap: anywhere;
}
h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
.site-info__list {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1rem;
}
.site-info__list > div {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.5rem;
  border-radius: 0.4rem;
  background: var(--surface-2);
  font-size: 0.75rem;
}
dt {
  color: var(--text-soft);
}
dd {
  margin: 0;
  font-weight: 500;
}
button,
textarea {
  max-width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
button {
  min-height: 44px;
}
button:disabled {
  opacity: 0.5;
}
p,
label {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
textarea {
  width: 100%;
  min-width: 0;
}
</style>
