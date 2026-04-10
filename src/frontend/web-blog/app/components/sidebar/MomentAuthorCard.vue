<!--
  @file MomentAuthorCard.vue
  @description 朋友圈右侧栏作者名片卡，展示博主信息和动态统计
  @author TixXin
  @since 2026-04-07
-->

<template>
  <section class="card moment-author-card">
    <div class="moment-author-card__profile">
      <div class="moment-author-card__avatar-ring">
        <NuxtImg
          src="/avatar-photo.webp"
          alt="TixXin"
          width="64"
          height="64"
          class="moment-author-card__avatar"
          format="webp"
        />
      </div>
      <h3 class="moment-author-card__name">TixXin</h3>
      <p class="moment-author-card__bio">记录生活点滴，分享技术与日常 ✨</p>
    </div>

    <div class="moment-author-card__stats">
      <div class="moment-author-card__stat">
        <span class="moment-author-card__stat-value">{{ stats.totalMoments }}</span>
        <span class="moment-author-card__stat-label">动态</span>
      </div>
      <div class="moment-author-card__stat-divider" />
      <div class="moment-author-card__stat">
        <span class="moment-author-card__stat-value">{{ stats.totalLikes }}</span>
        <span class="moment-author-card__stat-label">获赞</span>
      </div>
      <div class="moment-author-card__stat-divider" />
      <div class="moment-author-card__stat">
        <span class="moment-author-card__stat-value">{{ stats.totalDays }}</span>
        <span class="moment-author-card__stat-label">天</span>
      </div>
    </div>

    <div class="moment-author-card__mood">
      <Icon name="lucide:cloud-sun" size="14" class="moment-author-card__mood-icon" />
      <span class="moment-author-card__mood-text">{{ stats.currentMood }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface MomentAuthorStats {
  totalMoments: number
  totalLikes: number
  totalDays: number
  currentMood: string
}

defineProps<{
  stats: MomentAuthorStats
}>()
</script>

<style lang="scss" scoped>
.moment-author-card {
  padding: 1.5rem 1.25rem;
  text-align: center;
}

.moment-author-card__profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.25rem;
}

.moment-author-card__avatar-ring {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(135deg, var(--accent), #f59e0b, #ec4899);
  margin-bottom: 0.75rem;
  animation: ring-rotate 4s linear infinite;
}

.moment-author-card__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--surface-1);
}

.moment-author-card__name {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 0.25rem;
}

.moment-author-card__bio {
  font-size: 0.8125rem;
  color: var(--text-soft);
  margin: 0;
  line-height: 1.5;
}

.moment-author-card__stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.875rem 0;
  margin-bottom: 0.75rem;
  border-radius: $radius-md;
  background: var(--surface-2);
}

.moment-author-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  cursor: default;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);

    .moment-author-card__stat-value {
      color: var(--accent);
    }
  }
}

.moment-author-card__stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-main);
  transition: color 0.2s;
}

.moment-author-card__stat-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.moment-author-card__stat-divider {
  width: 1px;
  height: 1.5rem;
  background: var(--border-soft);
}

.moment-author-card__mood {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  font-size: 0.75rem;
  color: var(--text-soft);
}

.moment-author-card__mood-icon {
  color: var(--accent);
}

.moment-author-card__mood-text {
  font-weight: 500;
}

@keyframes ring-rotate {
  0% {
    filter: hue-rotate(0deg);
  }
  100% {
    filter: hue-rotate(360deg);
  }
}
</style>
