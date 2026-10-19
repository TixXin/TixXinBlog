<!--
  @file login.vue
  @description 博主管理登录页，不开放模拟注册或第三方假登录
-->
<template>
  <section class="admin-login">
    <h1>{{ t('admin-system.layout.titleLogin') }}</h1>
    <p v-if="route.query.changed === '1'" role="status">{{ t('admin-system.login.changed') }}</p>
    <p v-if="route.query.setup === 'done'" role="status">{{ t('admin-system.login.setupDone') }}</p>
    <div v-else-if="needsSetup" class="admin-login__setup" role="status">
      <p>{{ t('admin-system.login.setupNeeded') }}</p>
      <NuxtLink to="/setup"
        ><Icon name="lucide:wand-sparkles" aria-hidden="true" />{{ t('admin-system.login.setupLink') }}</NuxtLink
      >
    </div>
    <AuthLoginForm @authenticated="entered" @switch-view="showHelp = !showHelp" />
    <p v-if="showHelp">{{ t('admin-system.login.help') }}</p>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.layout.titleLogin'), robots: 'noindex, nofollow' })
const route = useRoute()
const showHelp = ref(false)
// 站点尚无管理员且开启了浏览器初始化时引导到 /setup；读取失败不影响登录。
const needsSetup = ref(false)
const fetchSetupStatus = useSetupStatus()
onMounted(async () => {
  try {
    needsSetup.value = await fetchSetupStatus()
  } catch {
    needsSetup.value = false
  }
})
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
  min-width: 0;
  margin: 3rem auto;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
}
.admin-login__setup {
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
.admin-login__setup p {
  margin: 0 0 0.5rem;
}
.admin-login__setup a {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}
.admin-login h1 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}
</style>
