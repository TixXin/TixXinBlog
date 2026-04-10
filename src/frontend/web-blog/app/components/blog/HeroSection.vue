<!--
  @file HeroSection.vue
  @description 首页顶部区域：一言 + 博主自述
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="hero-section">
    <div class="hero-section__content">
      <div class="hero-section__avatar">
        <NuxtImg
          src="/avatar.svg"
          alt="TixXin"
          width="80"
          height="80"
          class="hero-section__avatar-img"
          format="webp"
          @error="avatarError = true"
        />
        <div v-if="avatarError" class="hero-section__avatar-fallback">
          <Icon name="lucide:user" size="40" />
        </div>
      </div>

      <div class="hero-section__text">
        <h1 class="hero-section__name">TixXin</h1>
        <p class="hero-section__bio">
          前端开发工程师，热爱技术与生活。<br >
          在这里记录学习心得、项目经验和日常随笔。
        </p>

        <div class="hero-section__social">
          <a
            href="https://github.com/AYumeRNA"
            target="_blank"
            rel="noopener noreferrer"
            class="social-btn"
            aria-label="GitHub"
          >
            <Icon name="lucide:github" size="18" />
          </a>
          <a href="mailto:tixxin@example.com" class="social-btn" aria-label="Email">
            <Icon name="lucide:mail" size="18" />
          </a>
        </div>
      </div>
    </div>

    <div class="hero-section__hitokoto">
      <Icon name="lucide:quote" size="16" class="hitokoto-icon" />
      <span class="hitokoto-text">{{ hitokoto }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const avatarError = ref(false)

const hitokotos = [
  '路漫漫其修远兮，吾将上下而求索。',
  '保持热爱，奔赴山海。',
  '种一棵树最好的时间是十年前，其次是现在。',
  '心之所向，素履以往。',
  '不积跬步，无以至千里。',
]

const hitokoto = ref(hitokotos[0])

onMounted(() => {
  hitokoto.value = hitokotos[Math.floor(Math.random() * hitokotos.length)]
})
</script>

<style lang="scss" scoped>
.hero-section {
  padding: 2rem 1.5rem;
  background: var(--surface-1);
  border-radius: $radius-lg;
  border: 1px solid var(--border-soft);
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-card);
}

.hero-section__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  @media (min-width: $breakpoint-sm) {
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
}

.hero-section__avatar {
  width: 80px;
  height: 80px;
  border-radius: $radius-full;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  border: 2px solid var(--surface-1);
  box-shadow: 0 0 0 2px var(--border);
  flex-shrink: 0;
}

.hero-section__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-section__text {
  flex: 1;
}

.hero-section__name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 0.5rem;
}

.hero-section__bio {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.hero-section__social {
  display: flex;
  gap: 0.75rem;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-muted);
  transition: $transition-colors;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}

.hero-section__hitokoto {
  padding-top: 1.25rem;
  border-top: 1px dashed var(--border-soft);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  color: var(--text-faint);
  font-style: italic;
  font-size: 0.875rem;
}

.hitokoto-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: var(--text-soft);
}

.hitokoto-text {
  line-height: 1.6;
}
</style>
