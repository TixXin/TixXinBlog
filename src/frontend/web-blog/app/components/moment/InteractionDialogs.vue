<!-- @file InteractionDialogs.vue @description 页面持有的游客身份交互面板 -->
<template>
  <CommonGuestIdentityModal
    :visible="visible"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
    @login="$emit('login')"
  />
</template>
<script setup lang="ts">
defineProps<{ visible: boolean }>()
defineEmits<{ confirm: []; cancel: []; login: [] }>()
</script>
