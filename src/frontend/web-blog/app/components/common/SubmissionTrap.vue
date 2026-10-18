<!-- @file SubmissionTrap.vue @description 公开表单蜜罐，不进入读屏、键盘焦点或可见布局 -->
<template>
  <div hidden aria-hidden="true">
    <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
  </div>
</template>
<script setup lang="ts">
const website = defineModel<string>({ required: true })
</script>
