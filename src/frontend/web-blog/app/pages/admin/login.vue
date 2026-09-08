<!--
  @file login.vue
  @description 博主管理登录页，不开放模拟注册或第三方假登录
-->
<template>
  <section class="admin-login">
    <h1>博主登录</h1>
    <p v-if="route.query.changed === '1'" role="status">密码已修改，请使用新密码重新登录。</p>
    <AuthLoginForm @authenticated="entered" @switch-view="showHelp = !showHelp" />
    <p v-if="showHelp">请使用站点维护者提供的博主账号；需要恢复密码时请联系维护者。</p>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '博主登录', robots: 'noindex, nofollow' })
const route = useRoute()
const showHelp = ref(false)
async function entered() {
  const next =
    typeof route.query.next === 'string' && (route.query.next === '/admin' || route.query.next.startsWith('/admin/'))
      ? route.query.next
      : '/admin'
  await navigateTo(next)
}
</script>
<style scoped>
.admin-login {
  max-width: 400px;
  margin: 3rem auto;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
}
.admin-login h1 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}
</style>
