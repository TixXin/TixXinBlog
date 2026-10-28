<!--
  @file SidebarFooterCard.vue
  @description Nexus 左侧栏站点信息卡片，展示版权、备案号、链接、技术栈和运行状态；文案与链接来自站点设置
  @author TixXin
  @since 2026-04-09
-->

<template>
  <section class="card sidebar-footer-card">
    <!-- 版权信息 -->
    <p class="sidebar-footer-card__copyright">
      {{ copyrightText }}
      <a v-if="icp" class="sidebar-footer-card__icp" :href="icp.href" target="_blank" rel="noopener noreferrer">{{
        icp.number
      }}</a>
    </p>

    <!-- 页脚链接 -->
    <nav v-if="footerLinks.length" class="sidebar-footer-card__links" :aria-label="$t('theme.nexus.footerCard.links')">
      <template v-for="link in footerLinks" :key="link.href">
        <a
          v-if="link.external"
          :href="link.href"
          class="sidebar-footer-card__link"
          :target="link.newTab ? '_blank' : undefined"
          :rel="link.newTab ? 'noopener' : undefined"
        >
          {{ link.label }}
        </a>
        <NuxtLink v-else :to="link.href" class="sidebar-footer-card__link">{{ link.label }}</NuxtLink>
      </template>
    </nav>

    <!-- 分隔线 -->
    <div class="sidebar-footer-card__divider" aria-hidden="true" />

    <!-- 技术栈 -->
    <div class="sidebar-footer-card__powered">
      <span class="sidebar-footer-card__powered-label">Powered by</span>
      <template v-for="(item, idx) in poweredBy" :key="item.label">
        <span v-if="idx > 0" class="sidebar-footer-card__powered-amp" aria-hidden="true">&amp;</span>
        <a :href="item.href" class="sidebar-footer-card__powered-link" target="_blank" rel="noopener">
          {{ item.label }}
        </a>
      </template>
    </div>

    <!-- 运行状态 -->
    <CommonTooltip :content="$t('layout.footer.apiLatencyTip')" placement="top">
      <div class="sidebar-footer-card__status" role="status" tabindex="0">
        <span v-if="pingMs !== null" class="sidebar-footer-card__ping">
          <Icon name="lucide:activity" size="12" />
          API {{ pingMs }} ms
        </span>
        <span class="sidebar-footer-card__dot" />
        <span class="sidebar-footer-card__operational">{{ siteStatus.statusText }}</span>
      </div>
    </CommonTooltip>
  </section>
</template>

<script setup lang="ts">
const { copyrightText, icp, footerLinks, poweredBy, siteStatus } = useSiteInfo()
const { pingMs } = useApiLatency()
</script>

<style lang="scss" scoped>
.sidebar-footer-card {
  padding: calc(1rem * var(--nx-card-pad-scale, 1)) 1.25rem;
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

.sidebar-footer-card__icp {
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--accent-text);
  }
}

.sidebar-footer-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.875rem;
}

.sidebar-footer-card__link {
  position: relative;
  font-size: 0.6875rem;
  color: var(--text-muted);
  transition: color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉尺寸不变，伪元素把点击区扩到至少 24px 高
  &::after {
    content: '';
    position: absolute;
    inset: -4px -3px;
  }

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
  position: relative;
  font-weight: 600;
  color: var(--text-main);
  transition: opacity 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉尺寸不变，伪元素把点击区扩到至少 24px 高
  &::after {
    content: '';
    position: absolute;
    inset: -4px -3px;
  }

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
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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
