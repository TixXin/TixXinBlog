<!--
  @file AuthForgotForm.vue
  @description 登录帮助说明，明确区分已实现的管理员认证与未开放能力
-->
<template>
  <div class="auth-help">
    <p>本站尚未开通邮件找回密码。请联系站点维护者恢复博主账号。</p>
    <button type="button" class="auth-link" @click="$emit('switchView', 'login')">返回登录</button>
  </div>
</template>
<script setup lang="ts">
import type { AuthView } from '~/features/auth/types'
defineEmits<{ switchView: [view: AuthView] }>()
</script>
<style scoped>
.auth-help {
  line-height: 1.7;
  color: var(--text-muted);
}
</style>
