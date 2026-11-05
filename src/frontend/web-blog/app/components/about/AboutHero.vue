<!--
  @file AboutHero.vue
  @description 个人信息 Hero 组件，展示头像、简介和社交链接
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="about-hero">
    <CommonContentImage
      :src="profile.avatar"
      :alt="profile.avatarAlt || profile.name"
      class="about-hero__avatar"
      width="112"
      height="112"
      format="webp"
    />
    <h1 class="about-hero__name">{{ profile.name }}</h1>
    <p v-if="profile.bio" class="about-hero__bio">{{ profile.bio }}</p>
    <!-- 只放主要社交主页；完整联系方式在下方联系卡片。网页主页带 rel="me" 声明同一身份，供 Mastodon 等验证 -->
    <nav v-if="profile.socials.length" class="about-hero__socials" :aria-label="$t('misc.about.hero.profiles')">
      <a
        v-for="(s, index) in profile.socials"
        :key="`${index}-${s.href}`"
        :href="s.href"
        class="about-hero__social"
        :class="{ 'about-hero__social--primary': s.primary }"
        v-bind="linkAttrs(s.href)"
      >
        <Icon :name="s.icon" size="16" /> {{ s.label }}
      </a>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { Profile } from '~/features/about/types'
import { externalLinkAttrs as linkAttrs } from '~/features/about/links'

defineProps<{
  profile: Profile
}>()
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
  flex-wrap: wrap;
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
  }

  &--primary {
    background: var(--accent-action);
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
