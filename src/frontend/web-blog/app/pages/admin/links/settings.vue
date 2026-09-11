<!-- @file settings.vue @description 友链须知公开配置，维护规则及完整恢复副本 -->
<template>
  <section class="link-settings">
    <h1>友链须知设置</h1>
    <AdminBackLink to="/admin/links">返回友链管理</AdminBackLink>
    <p>以下须知会公开展示。公开申请、邮件通知和自动探活尚未开放，请按实际情况维护说明。</p>
    <ClientOnly
      ><CommonRequestFeedback
        v-if="pending || error"
        :pending="pending"
        :title="error || '正在读取须知'"
        :compact="!!draft"
        @retry="load"
      />
      <p v-if="notice" role="status">{{ notice }}</p>
      <section v-if="recovery" aria-label="须知恢复副本">
        <h2>发现未保存的须知</h2>
        <LinkRules :rules="recovery.rules" /><button type="button" :disabled="pending || !ready" @click="restore">
          恢复须知输入
        </button>
      </section>
      <section v-if="previousRecoveries.length" aria-label="其他内容库的须知副本">
        <h2>另外保留的须知</h2>
        <p>这些输入不自动写入当前内容库，请核对后手动录入。</p>
        <LinkRules v-for="copy in previousRecoveries" :key="copy.key" :rules="copy.value.rules" />
      </section>
      <form v-if="draft" @submit.prevent="save">
        <fieldset :disabled="pending || !ready">
          <legend>友链须知（最多12条）</legend>
          <div v-for="(rule, index) in draft.rules" :key="index">
            <label
              >须知 {{ index + 1
              }}<textarea
                v-model="draft.rules[index]"
                :aria-label="`友链须知 ${index + 1}`"
                rows="3"
                required
                maxlength="300"
              /></label
            ><button type="button" :aria-label="`移除须知 ${index + 1}`" @click="draft.rules.splice(index, 1)">
              移除须知
            </button>
          </div>
          <button type="button" :disabled="draft.rules.length >= 12" @click="draft.rules.push('')">添加须知</button>
        </fieldset>
        <AdminActionBar
          ><button type="submit" :disabled="pending || !ready || !dirty">保存友链须知</button></AdminActionBar
        >
        <p>服务器版本 {{ draft.revision }}{{ dirty ? ' · 有未保存输入' : '' }}</p>
      </form>
      <section v-if="conflict" aria-label="友链须知版本冲突">
        <h2>服务器最新须知</h2>
        <LinkRules :rules="conflict.rules" /><button type="button" :disabled="pending" @click="merge">
          保留输入，按最新版本继续合并
        </button>
      </section></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '友链须知设置', robots: 'noindex, nofollow' })
const {
  draft,
  conflict,
  recovery,
  previousRecoveries,
  pending,
  ready,
  error,
  notice,
  dirty,
  load,
  save,
  restore,
  merge,
} = useLinkSettingsEditor()
</script>
<style scoped lang="scss">
.link-settings {
  max-width: 850px;
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
a {
  color: var(--accent);
}
p {
  color: var(--text-muted);
}
fieldset {
  min-width: 0;
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.5rem;
}
textarea,
button {
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  color: var(--text-main);
  background: var(--surface-2);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
textarea {
  width: 100%;
}
button:disabled {
  opacity: 0.5;
}
</style>
