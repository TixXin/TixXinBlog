<!--
  @file RootLayoutHero.vue
  @description Aurora 主题首页 Hero 视觉区域：动态背景图轮播、视差与滚动跳转
  @author TixXin
  @since 2026-04-21
-->

<template>
  <section v-if="isHomePage" ref="heroRef" class="aurora-hero" @wheel="onHeroWheel">
    <div class="aurora-hero__bg-container">
      <Transition name="hero-fade">
        <div
          :key="currentHeroImage"
          class="aurora-hero__bg"
          :style="{
            ...heroParallaxStyle,
            backgroundImage: `url(${currentHeroImage})`,
          }"
        />
      </Transition>
      <div class="aurora-hero__overlay" />
    </div>
    <div class="aurora-hero__inner">
      <!-- 站点名是品牌展示，不占用页面唯一 h1（首页 h1 由页面自身提供） -->
      <p class="aurora-hero__title">{{ siteSettings.name }}</p>
      <p class="aurora-hero__subtitle">{{ siteSettings.description }}</p>
    </div>
    <button
      class="aurora-hero__play"
      type="button"
      :disabled="reducedMotion"
      :aria-pressed="rotationEnabled"
      @click="rotationEnabled = !rotationEnabled"
    >
      <Icon v-if="rotationEnabled" name="lucide:pause" size="15" />
      <Icon v-else name="lucide:play" size="15" />
      {{
        $t(
          reducedMotion
            ? 'theme.aurora.hero.staticBackground'
            : rotationError
              ? 'theme.aurora.hero.retryRotation'
              : rotationEnabled
                ? 'theme.aurora.hero.pauseBackground'
                : 'theme.aurora.hero.playBackground',
        )
      }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { useDocumentVisibility } from '@vueuse/core'
import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'

const props = defineProps<{
  scrollY: number
  viewport: HTMLElement | null
}>()

const { reducedMotion } = useMotionPreference()
const documentVisibility = useDocumentVisibility()
const { settings: siteSettings } = useSiteSettings()
const route = useRoute()

const heroRef = ref<HTMLElement | null>(null)
const heroOnscreen = ref(true)
const rotationEnabled = ref(false)
const rotationError = ref(false)
let heroObserver: IntersectionObserver | undefined

const isHomePage = computed(() => route.path === '/' || route.path === '/moments')

// --- 动态背景图 ---
const heroImages = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2670',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2670',
  'https://images.unsplash.com/photo-1434725039720-abb26ce89892?auto=format&fit=crop&q=80&w=2670',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=2670',
]
const currentImageIndex = ref(0)
const currentHeroImage = computed(() => heroImages[currentImageIndex.value])

let imageTimer: ReturnType<typeof setInterval> | null = null
let pendingImage: HTMLImageElement | null = null
let rotationVersion = 0

function stopImageRotation() {
  rotationVersion++
  if (imageTimer) clearInterval(imageTimer)
  imageTimer = null
  if (pendingImage) {
    pendingImage.onload = null
    pendingImage.onerror = null
    pendingImage.src = ''
    pendingImage = null
  }
}

function startImageRotation() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  rotationError.value = false
  const version = rotationVersion
  imageTimer = setInterval(() => {
    if (pendingImage) return
    const index = (currentImageIndex.value + 1) % heroImages.length
    const image = new Image()
    pendingImage = image
    image.onload = () => {
      if (rotationVersion !== version) return
      currentImageIndex.value = index
      pendingImage = null
    }
    image.onerror = () => {
      if (rotationVersion !== version) return
      pendingImage = null
      rotationEnabled.value = false
      rotationError.value = true
    }
    image.src = heroImages[index]!
  }, 8000)
}

watch([rotationEnabled, reducedMotion, documentVisibility, heroOnscreen, isHomePage], () => {
  stopImageRotation()
  if (
    rotationEnabled.value &&
    !reducedMotion.value &&
    documentVisibility.value === 'visible' &&
    heroOnscreen.value &&
    isHomePage.value
  )
    startImageRotation()
})

watch(reducedMotion, (reduced) => {
  if (reduced) rotationEnabled.value = false
})

function observeHero() {
  heroObserver?.disconnect()
  if (!heroRef.value) return
  heroObserver = new IntersectionObserver(
    ([entry]) => {
      heroOnscreen.value = !!entry?.isIntersecting
    },
    { root: resolveScrollRoot(heroRef.value.parentElement) },
  )
  heroObserver.observe(heroRef.value)
}

watch([heroRef, () => props.viewport], observeHero, { flush: 'post' })

function onHeroWheel(e: WheelEvent) {
  if (reducedMotion.value) return
  if (e.deltaY > 0 && props.scrollY < 10) {
    const viewport = props.viewport
    if (viewport) {
      const heroEl = heroRef.value ?? (viewport.querySelector('.aurora-hero') as HTMLElement | null)
      if (heroEl) {
        scrollToRoot(resolveScrollRoot(viewport), heroEl.offsetHeight)
        e.preventDefault()
      }
    }
  }
}

const heroParallaxStyle = computed(() => ({
  transform: `translateY(${reducedMotion.value || !heroOnscreen.value ? 0 : Math.min(props.scrollY, 500) * 0.15}px)`,
}))

onMounted(() => {
  window.addEventListener('resize', observeHero)
})

onBeforeUnmount(() => {
  stopImageRotation()
  heroObserver?.disconnect()
  window.removeEventListener('resize', observeHero)
})
</script>

<style lang="scss" scoped>
.aurora-hero {
  position: relative;
  height: var(--aurora-hero-height);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;

  @media (max-width: #{$breakpoint-md - 0.02}) {
    height: calc(var(--aurora-hero-height) / 2);
  }
}

.aurora-hero__bg-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
}

.aurora-hero__bg {
  position: absolute;
  inset: -20%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 1;
}

.aurora-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.4), rgba(22, 33, 62, 0.6));
  z-index: 2;
}

.hero-fade-enter-active {
  transition: opacity 0.8s ease-in-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  z-index: 2;
}

.hero-fade-leave-active {
  transition: opacity 0.8s ease-in-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  z-index: 1;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}

.aurora-hero__inner {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
}

.aurora-hero__play {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  z-index: 3;
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: $radius-full;
  font-size: 0.75rem;
}

.aurora-hero__title {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.75rem;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.2);

  @media (max-width: #{$breakpoint-md - 0.02}) {
    font-size: 1.75rem;
  }
}

.aurora-hero__subtitle {
  font-size: 1.125rem;
  font-weight: 400;
  opacity: 0.85;
  margin: 0;

  @media (max-width: #{$breakpoint-md - 0.02}) {
    font-size: 0.875rem;
  }
}
</style>
