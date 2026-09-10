<!--
  @file ActiveSessions.vue
  @description 以最小设备信息展示活跃会话，管理动作由页面传入。
-->
<template>
  <section class="active-sessions" aria-label="活跃管理会话">
    <h2>活跃会话</h2>
    <p>退出或撤销会立即阻止后续管理请求；正在处理的操作可能仍会完成。成功续期后到期时间延后 7 天。</p>
    <p>设备名称由客户端提供的标识概括，仅供识别，不代表可信设备认证。时间按本机时区显示。</p>
    <button type="button" :disabled="pending || disabled" @click="$emit('load', page)">刷新会话</button
    ><button type="button" :disabled="pending || disabled || total <= 1" @click="$emit('revoke-others')">
      撤销其他全部会话
    </button>
    <p v-if="pending" role="status">正在处理会话…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul>
      <li v-for="item in items" :key="item.id" :data-session-id="item.id">
        <h3>{{ item.device }}{{ item.current ? ' · 当前会话' : '' }}</h3>
        <p>登录时间：{{ item.loginAt ? date(item.loginAt) : '未知（从旧登录迁移）' }}</p>
        <p>最近续期：{{ date(item.lastRefreshedAt) }}</p>
        <p>到期时间：{{ date(item.expiresAt) }}</p>
        <button type="button" :disabled="pending || disabled" @click="$emit('revoke', item)">
          {{ item.current ? '撤销当前会话并退出' : '撤销此会话' }}
        </button>
      </li>
    </ul>
    <p v-if="!pending && !error && !items.length">没有可显示的有效会话</p>
    <button type="button" :disabled="pending || disabled || page <= 1" @click="$emit('load', page - 1)">
      上一页会话</button
    ><span> {{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 个 </span
    ><button type="button" :disabled="pending || disabled || page * 20 >= total" @click="$emit('load', page + 1)">
      下一页会话
    </button>
  </section>
</template>
<script setup lang="ts">
import type { AdminSessionItem } from '~/features/auth/sessionTypes'
defineProps<{
  items: AdminSessionItem[]
  total: number
  page: number
  pending: boolean
  error: string
  disabled: boolean
}>()
defineEmits<{ load: [page: number]; revoke: [item: AdminSessionItem]; 'revoke-others': [] }>()
function date(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>
<style scoped>
.active-sessions {
  margin-top: 2rem;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1.2rem;
}
h3 {
  font-weight: 600;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
ul {
  padding: 0;
  list-style: none;
}
li {
  padding: 1rem;
  margin-block: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
button {
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
  margin: 0.25rem;
}
button:disabled {
  opacity: 0.5;
}
</style>
