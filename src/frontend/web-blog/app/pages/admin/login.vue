<!--
  @file login.vue
  @description 博主管理登录页，不开放模拟注册或第三方假登录
-->
<template>
  <div class="login-page">
    <section class="login" aria-labelledby="login-title">
      <header class="login__head">
        <div class="login__brand">
          <img class="login__mark" src="/icon.svg" alt="" width="44" height="44" />
        </div>
        <div>
          <h1 id="login-title" class="login__title">{{ t('admin-system.layout.titleLogin') }}</h1>
        </div>
      </header>

      <p v-if="route.query.changed === '1'" class="login__notice login__notice--info" role="status">
        <Icon name="lucide:check-circle" aria-hidden="true" /><span>{{ t('admin-system.login.changed') }}</span>
      </p>
      <p v-if="route.query.setup === 'done'" class="login__notice login__notice--info" role="status">
        <Icon name="lucide:check-circle" aria-hidden="true" /><span>{{ t('admin-system.login.setupDone') }}</span>
      </p>
      <div v-else-if="needsSetup" class="login__setup" role="status">
        <p>{{ t('admin-system.login.setupNeeded') }}</p>
        <NuxtLink to="/setup"
          ><Icon name="lucide:wand-sparkles" aria-hidden="true" />{{ t('admin-system.login.setupLink') }}</NuxtLink
        >
      </div>

      <AuthLoginForm hide-hint @authenticated="entered" @switch-view="showHelp = !showHelp" />
      <p v-if="showHelp" class="login__help">{{ t('admin-system.login.help') }}</p>
    </section>
  </div>
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
const preview = useDevPreview()
async function readNeedsSetup() {
  try {
    // 开发模式下 ?preview=setup-pending 直接显示引导；生产构建中不生效
    needsSetup.value = preview('setup-pending') || (await fetchSetupStatus())
  } catch {
    needsSetup.value = false
  }
}
onMounted(readNeedsSetup)
// 调试面板在同一页面切换或退出预览时只改地址参数，需要重新判定
if (import.meta.dev) watch(() => preview('setup-pending'), readNeedsSetup)
async function entered() {
  const next =
    typeof route.query.next === 'string' && (route.query.next === '/admin' || route.query.next.startsWith('/admin/'))
      ? route.query.next
      : '/admin'
  await navigateTo(next)
}
</script>
<style scoped lang="scss">
// 安全居中：放得下时上下居中，放不下时从顶部开始自然滚动；
// 减去顶栏高度（3.75rem）和 admin-content 上下内边距（1.75rem + 3rem）
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100dvh - 8.5rem);
}

.login {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 460px;
  min-width: 0;
  margin-block: auto;
  padding: 1.75rem 2rem;
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  background: var(--surface-1);
  box-shadow: var(--shadow-card);
  overflow-wrap: anywhere;
  transition:
    $transition-colors,
    box-shadow 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.login__head {
  flex-shrink: 0;
  margin-bottom: 1.25rem;
}

.login__brand {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.login__mark {
  display: block;
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: $radius-md;
}

.login__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  transition: color 0.3s ease;
}

.login__notice {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0 0 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  font-size: 0.8125rem;
  transition: $transition-colors;

  svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  &--info {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }
}

.login__setup {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  font-size: 0.8125rem;
  transition: $transition-colors;

  p {
    margin: 0 0 0.5rem;
    color: var(--text-muted);
  }

  a {
    display: inline-flex;
    gap: 0.375rem;
    align-items: center;
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.login__help {
  margin: 0.75rem 0 0;
  padding: 0.75rem 1rem;
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.55;
  transition: $transition-colors;
}

@media (max-width: 520px) {
  .login {
    padding: 1.5rem 1.25rem;
  }
}
</style>
