<!--
  @file TabWallpaperLayer.vue
  @description 标签页壁纸背景层：Teleport 到 body，固定在视口底部（z-index: -1）
  @author TixXin
  @since 2026-04-15

  支持四种壁纸类型 + 亮暗独立 + mask/blur/noise/vignette 叠加层。
  上传类型的壁纸存储在 IndexedDB，通过 uploadKey 懒加载为 Object URL。
-->

<template>
  <ClientOnly>
    <Teleport to="body">
      <div v-if="hasWallpaper" class="tab-wp" aria-hidden="true">
        <div class="tab-wp__layer" :style="layerStyle" />
        <div v-if="maskOpacity > 0" class="tab-wp__mask" :style="maskStyle" />
        <div v-if="s.wallpaperNoise" class="tab-wp__noise" />
        <div v-if="s.wallpaperVignette" class="tab-wp__vignette" />
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { WallpaperConfig } from '~/composables/useTabSettings'
import { findWallpaper } from '~/features/tab/wallpapers'
import { idbGet } from '~/utils/idbBlob'

const { settings } = useTabSettings()
const s = settings
const colorMode = useColorMode()

/** 当前激活壁纸配置：亮暗独立 / 共用 */
const active = computed<WallpaperConfig>(() => {
  if (s.value.wallpaperIndependent) {
    return colorMode.value === 'dark' ? s.value.wallpaperDark : s.value.wallpaperLight
  }
  return s.value.wallpaperLight
})

const hasWallpaper = computed(() => active.value.kind !== 'none')

/**
 * body 默认有 `background-color: var(--bg)` + 点状背景，会完全盖住 z-index:-1 的
 * wallpaper 层。挂载时动态加 class，把 body 背景变透明，让壁纸能透出来。
 */
watchEffect(() => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('has-tab-wallpaper', hasWallpaper.value)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('has-tab-wallpaper')
  }
})

/** 上传壁纸的 Object URL：由 idbGet 按 uploadKey 懒加载 */
const objectUrl = ref<string | null>(null)

watchEffect(async (onCleanup) => {
  if (active.value.kind !== 'upload' || !active.value.uploadKey) {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = null
    }
    return
  }
  try {
    const blob = await idbGet(active.value.uploadKey)
    if (!blob) {
      objectUrl.value = null
      return
    }
    const url = URL.createObjectURL(blob)
    objectUrl.value = url
    onCleanup(() => URL.revokeObjectURL(url))
  } catch {
    objectUrl.value = null
  }
})

const layerStyle = computed<Record<string, string>>(() => {
  const a = active.value
  const blur = s.value.wallpaperBlur
  const base: Record<string, string> = {
    filter: blur > 0 ? `blur(${blur}px)` : '',
    transform: blur > 0 ? 'scale(1.08)' : '',
  }
  switch (a.kind) {
    case 'solid':
      return { ...base, background: a.solidColor ?? '#0f172a' }
    case 'gradient': {
      const g = a.gradient
      if (!g) return { ...base, background: '#0f172a' }
      const stops = [g.from, g.via, g.to].filter(Boolean).join(', ')
      return { ...base, background: `linear-gradient(${g.angle}deg, ${stops})` }
    }
    case 'preset': {
      const wp = findWallpaper(a.presetId)
      if (!wp) return { ...base }
      return {
        ...base,
        backgroundImage: `url(${wp.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    case 'url':
      return {
        ...base,
        backgroundImage: `url(${a.url ?? ''})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    case 'upload':
      return objectUrl.value
        ? {
            ...base,
            backgroundImage: `url(${objectUrl.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { ...base }
    default:
      return {}
  }
})

const maskOpacity = computed(() => s.value.wallpaperMaskOpacity)
const maskStyle = computed(() => ({
  background: colorMode.value === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)',
  opacity: String(maskOpacity.value),
}))
</script>

<style lang="scss" scoped>
.tab-wp {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.tab-wp__layer {
  position: absolute;
  inset: -24px; // 留出空间给 blur 放大后的溢出
  transition: filter 0.3s ease, background 0.3s ease;
}

.tab-wp__mask {
  position: absolute;
  inset: 0;
  transition: opacity 0.3s ease;
}

/* 噪点：SVG 图案，平铺在壁纸之上增加质感 */
.tab-wp__noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  opacity: 0.35;
  mix-blend-mode: overlay;
}

/* 暗角：径向渐变 */
.tab-wp__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45) 100%);
}
</style>

<!-- 非 scoped：让 body 默认背景/点状图案让位，保证 z-index:-1 的壁纸层可见 -->
<style>
body.has-tab-wallpaper {
  background-color: transparent !important;
  background-image: none !important;
}
</style>
