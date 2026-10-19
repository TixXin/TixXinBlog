<!--
  @file AuthRegisterForm.vue
  @description 参与讨论说明，明确区分已实现的管理员认证与未开放能力
-->
<template>
  <div class="auth-help">
    <p>{{ $t('interaction.auth.registerText') }}</p>
    <button type="button" class="auth-link" @click="$emit('switchView', 'login')">
      {{ $t('interaction.auth.backToLogin') }}
    </button>
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
