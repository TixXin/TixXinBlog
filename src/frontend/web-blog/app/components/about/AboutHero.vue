<!--
  @file AboutHero.vue
  @description 个人信息 Hero 组件，展示头像、简介和社交链接
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="about-hero">
    <img :src="profile.avatar" :alt="profile.name" class="about-hero__avatar" width="112" height="112" @error="onAvatarError" />
    <h2 class="about-hero__name">{{ profile.name }}</h2>
    <p class="about-hero__bio">{{ profile.bio }}</p>
    <div class="about-hero__socials">
      <a
        v-for="s in profile.socials"
        :key="s.label"
        :href="s.href"
        class="about-hero__social"
        :class="{ 'about-hero__social--primary': s.primary }"
        target="_blank"
        rel="noopener"
      >
        <Icon :name="s.icon" size="16" /> {{ s.label }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Profile } from '~/features/about/types'

defineProps<{
  profile: Profile
}>()

const AVATAR_FALLBACK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" fill="%23666"><rect width="112" height="112" rx="56" fill="%23333"/><text x="56" y="62" text-anchor="middle" font-size="40" fill="%23888">?</text></svg>')

function onAvatarError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = AVATAR_FALLBACK
}
</script>

<style lang="scss" scoped>
.about-hero {
  text-align: center;
  margin-bottom: 2.5rem;
}

.about-hero__avatar {
  width: 7rem;
  height: 7rem;
  border-radius: $radius-full;
  margin: 0 auto 1.25rem;
  border: 4px solid var(--surface-1);
  box-shadow: var(--shadow-card);
  object-fit: cover;
}

.about-hero__name {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.about-hero__bio {
  font-size: 0.875rem;
  color: var(--text-muted);
  max-width: 28rem;
  margin: 0 auto;
  line-height: 1.6;
}

.about-hero__socials {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.about-hero__social {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: $radius-md;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  background: var(--surface-3);
  color: var(--text-main);
  transition: $transition-fast;

  &:hover {
    background: var(--surface-2);
  }

  &--primary {
    background: var(--accent);
    color: #fff;

    .dark & {
      background: var(--surface-3);
      color: var(--text-main);
    }

    &:hover {
      opacity: 0.9;
    }
  }
}
</style>
