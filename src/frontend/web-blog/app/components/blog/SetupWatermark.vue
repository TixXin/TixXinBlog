<!-- @file SetupWatermark.vue @description 新装站点尚未初始化时的全屏半透明水印提示 -->
<template>
  <!-- 只在尚无博主账号时于浏览器端显示，不进入服务端渲染与页面缓存；初始化完成后自动消失。
       全屏半透明水印不拦截点击，也不挤占内容位置 -->
  <Teleport v-if="setupPending" to="body">
    <div class="setup-watermark" role="status">
      <div class="setup-watermark__inner">
        <p class="setup-watermark__title">{{ $t('article.home.setupWatermark') }}</p>
        <p class="setup-watermark__text">{{ $t('article.home.setupPending') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 新装站点首页没有任何内容，提示博主用安装时输出的链接完成初始化；读取失败时不显示
const setupPending = ref(false)
const fetchSetupStatus = useSetupStatus()
const preview = useDevPreview()

async function readSetupPending() {
  try {
    // 开发模式下 ?preview=setup-pending 直接显示提示，便于调整样式；生产构建中不生效
    setupPending.value = preview('setup-pending') || (await fetchSetupStatus())
  } catch {
    setupPending.value = false
  }
}

onMounted(readSetupPending)

// 调试面板在同一页面切换或退出预览时只改地址参数，需要重新判定
if (import.meta.dev) watch(() => preview('setup-pending'), readSetupPending)
</script>

<style lang="scss" scoped>
.setup-watermark {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}
.setup-watermark__inner {
  max-width: min(90vw, 56rem);
  text-align: center;
  transform: rotate(-16deg);
}
.setup-watermark__title {
  margin: 0;
  color: var(--text-main);
  font-size: clamp(3rem, 11vw, 9rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.04em;
  opacity: 0.06;
}
.setup-watermark__text {
  margin: 0.75rem auto 0;
  max-width: 32rem;
  color: var(--text-main);
  font-size: clamp(0.875rem, 1.6vw, 1.125rem);
  font-weight: 600;
  opacity: 0.13;
}
</style>
