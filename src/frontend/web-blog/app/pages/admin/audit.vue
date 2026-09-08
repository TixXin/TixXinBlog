<!--
  @file audit.vue
  @description 管理操作只读审计：按操作、结果和 UTC 日期检索。
-->
<template>
  <section class="admin-audit">
    <h1>操作审计</h1>
    <p>
      记录管理写入的操作者、对象、结果和提交字段，不保存密码、令牌或完整内容。提交字段表示本次请求携带的字段，不代表每个值都发生变化。
    </p>
    <ClientOnly>
      <form @submit.prevent="navigate(1)">
        <label
          >管理操作<select v-model="action">
            <option value="">全部操作</option>
            <option v-for="(label, key) in actions" :key="key" :value="key">{{ label }}</option>
          </select></label
        >
        <label
          >处理结果<select v-model="state">
            <option value="">全部结果</option>
            <option v-for="(label, key) in auditStateLabels" :key="key" :value="key">{{ label }}</option>
          </select></label
        >
        <label>开始日期（UTC）<input v-model="from" type="date" /></label
        ><label>结束日期（UTC）<input v-model="to" type="date" /></label>
        <button type="submit" :disabled="pending">筛选审计记录</button
        ><button type="button" :disabled="pending" @click="clear">清除筛选</button
        ><button type="button" :disabled="pending" @click="load">刷新记录</button>
      </form>
      <p v-if="actionsError" role="alert">
        {{ actionsError }} <button type="button" @click="loadActions">重试选项</button>
      </p>
      <p v-if="!error && (health.waitingResults || health.retryQueue || health.droppedRetries)" role="status">
        {{ health.waitingResults }} 条结果尚未确认，{{ health.retryQueue }} 条正在等待补全。{{
          health.droppedRetries ? '部分结果需要人工核对对象状态。' : ''
        }}
      </p>
      <p v-if="pending" role="status">正在读取审计记录…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <AdminAuditLog :items="items" />
      <p v-if="!pending && !error && !items.length">暂无符合条件的审计记录</p>
      <button type="button" :disabled="pending || page <= 1" @click="navigate(page - 1)">上一页记录</button
      ><span> {{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 条 </span
      ><button type="button" :disabled="pending || page * 20 >= total" @click="navigate(page + 1)">下一页记录</button>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { auditStateLabels } from '~/features/audit/types'
definePageMeta({ layout: 'admin', key: '/admin/audit' })
useSeoMeta({ title: '操作审计', robots: 'noindex, nofollow' })
const {
  items,
  total,
  page,
  action,
  state,
  from,
  to,
  actions,
  actionsError,
  loadActions,
  pending,
  error,
  health,
  navigate,
  load,
  clear,
} = useAuditLogs()
</script>
<style scoped>
h1 {
  font-size: 1.6rem;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  margin-block: 1rem;
}
label {
  display: grid;
  gap: 0.5rem;
}
button,
select,
input {
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.6rem;
  max-width: 100%;
}
button:disabled {
  opacity: 0.5;
}
</style>
