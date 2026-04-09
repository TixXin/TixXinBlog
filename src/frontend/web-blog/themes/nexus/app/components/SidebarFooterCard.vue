<!--
  @file SidebarFooterCard.vue
  @description Nexus 左侧栏站点信息卡片，展示版权、链接、技术栈和运行状态
  @author TixXin
  @since 2026-04-09
-->

<template>
  <section class="card sidebar-footer-card">
    <!-- 版权信息 -->
    <p class="sidebar-footer-card__copyright">&copy; {{ currentYear }} TixXin Blog. All rights reserved.</p>

    <!-- 页脚链接 -->
    <nav class="sidebar-footer-card__links" aria-label="站点链接">
      <a v-for="link in footerLinks" :key="link.label" :href="link.href" class="sidebar-footer-card__link">
        {{ link.label }}
      </a>
    </nav>

    <!-- 分隔线 -->
    <div class="sidebar-footer-card__divider" />

    <!-- 技术栈 -->
    <div class="sidebar-footer-card__powered">
      <span class="sidebar-footer-card__powered-label">Powered by</span>
      <template v-for="(item, idx) in poweredBy" :key="item.label">
        <span v-if="idx > 0" class="sidebar-footer-card__powered-amp">&amp;</span>
        <a :href="item.href" class="sidebar-footer-card__powered-link" target="_blank" rel="noopener">
          {{ item.label }}
        </a>
      </template>
    </div>

    <!-- 运行状态 -->
    <div class="sidebar-footer-card__status">
      <span class="sidebar-footer-card__ping">
        <Icon name="lucide:activity" size="12" />
        PING {{ siteStatus.pingMs }}ms
      </span>
      <span class="sidebar-footer-card__dot" />
      <span class="sidebar-footer-card__operational">{{ siteStatus.statusText }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
const { footerLinks, poweredBy, siteStatus } = useSiteInfo()
</script>

<style lang="scss" scoped>
.sidebar-footer-card {
  padding: 1rem 1.25rem;
  display: none;

  @media (min-width: $breakpoint-lg) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}

.sidebar-footer-card__copyright {
  font-size: 0.6875rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.sidebar-footer-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.875rem;
}

.sidebar-footer-card__link {
  font-size: 0.6875rem;
  color: var(--text-muted);
  transition: color 0.2s;

  &:hover {
    color: var(--text-main);
  }
}

.sidebar-footer-card__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.125rem 0;
}

.sidebar-footer-card__powered {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.sidebar-footer-card__powered-label {
  opacity: 0.85;
}

.sidebar-footer-card__powered-amp {
  opacity: 0.6;
}

.sidebar-footer-card__powered-link {
  font-weight: 600;
  color: var(--text-main);
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.82;
  }
}

.sidebar-footer-card__status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.sidebar-footer-card__ping {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: ui-monospace, monospace;
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding: 0.15rem 0.4rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-full;
}

.sidebar-footer-card__dot {
  flex-shrink: 0;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--stat-green-dot);
  box-shadow: 0 0 0 2px var(--stat-green-bg);
  animation: sidebar-pulse-dot 2s infinite;
}

.sidebar-footer-card__operational {
  color: var(--stat-green);
  font-weight: 500;
  font-size: 0.625rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes sidebar-pulse-dot {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}
</style>
