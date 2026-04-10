<!--
  @file OwnerProfileCard.vue
  @description Nexus 左侧栏博主名片卡，展示头像、名称、在线状态、简介和社交链接
  @author TixXin
  @since 2026-04-10
-->

<template>
  <section class="card owner-profile-card">
    <!-- 头像 + 在线状态 -->
    <div class="owner-profile-card__avatar-wrap">
      <NuxtImg
        src="/avatar-photo.webp"
        :alt="ownerCard.name"
        width="72"
        height="72"
        class="owner-profile-card__avatar"
        format="webp"
      />
      <span
        class="owner-profile-card__presence-dot"
        :class="`--${ownerPresence.status}`"
        :title="ownerPresence.label"
      />
    </div>

    <!-- 名字 -->
    <h2 class="owner-profile-card__name">{{ ownerCard.name }}</h2>

    <!-- 状态签名 -->
    <p class="owner-profile-card__status-line">
      <span class="owner-profile-card__status-label">{{ ownerPresence.label }}</span>
      <span class="owner-profile-card__status-sep">&middot;</span>
      <span class="owner-profile-card__status-sig">{{ ownerPresence.signature }}</span>
    </p>

    <!-- 个人简介 -->
    <p class="owner-profile-card__title">{{ ownerCard.title }}</p>

    <!-- 社交链接 -->
    <nav class="owner-profile-card__socials" aria-label="社交链接">
      <a
        v-for="social in ownerCard.socials"
        :key="social.label"
        :href="social.href"
        class="owner-profile-card__social-link"
        :aria-label="social.label"
        target="_blank"
        rel="noopener"
      >
        <Icon :name="social.icon" size="18" />
      </a>
    </nav>
  </section>
</template>

<script setup lang="ts">
const { ownerCard, ownerPresence } = useSiteInfo()
</script>

<style lang="scss" scoped>
.owner-profile-card {
  padding: 1.5rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.375rem;
}

/* 头像容器 */
.owner-profile-card__avatar-wrap {
  position: relative;
  margin-bottom: 0.25rem;
}

.owner-profile-card__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 2.5px solid var(--border);
  transition: border-color 0.3s, transform 0.3s;

  &:hover {
    border-color: var(--accent);
    transform: scale(1.05);
  }
}

/* 在线状态点 */
.owner-profile-card__presence-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2.5px solid var(--surface-1);
  transition: background-color 0.3s;

  &.--online {
    background: var(--presence-online);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    animation: owner-presence-pulse 2s infinite;
  }

  &.--idle {
    background: var(--presence-idle);
  }

  &.--busy {
    background: var(--presence-busy);
  }

  &.--offline {
    background: var(--text-faint);
  }
}

/* 名字 */
.owner-profile-card__name {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.3;
}

/* 状态行 */
.owner-profile-card__status-line {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  line-height: 1.4;
}

.owner-profile-card__status-sep {
  opacity: 0.5;
}

/* 个人简介 */
.owner-profile-card__title {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 0.125rem;
  margin-bottom: 0.375rem;
}

/* 社交链接 */
.owner-profile-card__socials {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.owner-profile-card__social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-muted);
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent);
    transform: translateY(-2px);
  }
}

@keyframes owner-presence-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}
</style>
