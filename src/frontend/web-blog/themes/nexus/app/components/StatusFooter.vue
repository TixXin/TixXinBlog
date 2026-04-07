<template>
  <div class="nexus-footer-wrap">
    <div class="nexus-footer__avatar-container">
      <NuxtImg src="/avatar.jpg" alt="TixXin" width="48" height="48" class="nexus-footer__avatar" format="webp" />
    </div>
    <SharedStatusFooter class="nexus-footer-main" />
  </div>
</template>

<script setup lang="ts">
import SharedStatusFooter from '../../../../app/components/layout/StatusFooter.vue'
</script>

<style lang="scss" scoped>
.nexus-footer-wrap {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem 2.5rem;
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  min-height: 5.5rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  position: relative;
  transition: all 0.3s ease;

  @media (max-width: #{$breakpoint-lg - 0.02}) {
    display: none;
  }
}

.nexus-footer__avatar-container {
  position: absolute;
  left: -1rem; // 让头像“在外面”挂着
  top: 50%;
  transform: translateY(-50%);
  background: var(--surface-1);
  padding: 4px;
  border-radius: 50%;
  box-shadow: var(--shadow-md);
  z-index: 5;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:hover {
    transform: translateY(-50%) scale(1.1) rotate(-8deg);
  }
}

.nexus-footer__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--accent);
}

.nexus-footer-main {
  flex: 1;
  padding-left: 1.5rem; // 给头像留一点视觉空隙
}

:deep(.site-footer) {
  display: flex !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  backdrop-filter: none !important;
  width: 100%;
}
</style>
