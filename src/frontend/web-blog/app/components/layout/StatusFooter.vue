<!--
  @file StatusFooter.vue
  @description 站点底部页脚组件，展示版权信息、链接和系统状态
  @author TixXin
  @since 2025-03-17
-->

<template>
  <footer class="site-footer">
    <div class="footer__left">
      <span class="footer__copyright">&copy; {{ currentYear }} TixXin Blog. All rights reserved.</span>
      <nav class="footer__links" aria-label="页脚链接">
        <a v-for="link in footerLinks" :key="link.label" :href="link.href">{{ link.label }}</a>
      </nav>
    </div>
    <div class="footer__right">
      <div class="footer__powered">
        <span class="footer__powered-label">Powered by</span>
        <template v-for="(item, idx) in poweredBy" :key="item.label">
          <span v-if="idx > 0" class="footer__powered-amp">&amp;</span>
          <a :href="item.href" class="footer__powered-link" target="_blank" rel="noopener">{{ item.label }}</a>
        </template>
      </div>
      <div class="footer__divider" aria-hidden="true" />
      <CommonTooltip content="服务器延迟" placement="top">
        <div class="footer__status" role="status">
          <span class="footer__ping"><Icon name="lucide:activity" size="12" /> PING {{ siteStatus.pingMs }}ms</span>
          <span class="footer__dot" />
          <span class="footer__operational">{{ siteStatus.statusText }}</span>
        </div>
      </CommonTooltip>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
const { footerLinks, poweredBy, siteStatus } = useSiteInfo()
</script>

<style lang="scss" scoped>
.site-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem 1.75rem;
  width: 100%;
}

.footer__left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--text-muted);
  min-width: 0;
}

.footer__copyright {
  font-size: 0.6875rem;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.footer__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1.125rem;
  min-width: 0;

  a {
    font-size: 0.6875rem;
    transition: color 0.2s;

    &:hover {
      color: var(--text-main);
    }
  }
}

.footer__right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: flex-end;
  color: var(--text-muted);
  min-width: 0;
}

.footer__powered {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.25rem 0.375rem;
  font-size: 0.6875rem;
}

.footer__powered-label {
  opacity: 0.85;
}

.footer__powered-amp {
  opacity: 0.6;
}

.footer__powered-link {
  font-weight: 600;
  color: var(--text-main);
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.82;
  }
}

.footer__divider {
  width: 1px;
  height: 0.875rem;
  flex-shrink: 0;
  background: var(--border);
}

.footer__status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: min(100%, 16rem);
  min-width: 0;
}

.footer__ping {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-full;
}

.footer__dot {
  flex-shrink: 0;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--stat-green-dot);
  box-shadow: 0 0 0 2px var(--stat-green-bg);
  animation: pulse-dot 2s infinite;
}

.footer__operational {
  color: var(--stat-green);
  font-weight: 500;
  font-size: 0.625rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: #{$breakpoint-xl - 0.02}) {
  .site-footer {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .footer__right {
    justify-content: flex-start;
    width: 100%;
  }

  .footer__divider {
    display: none;
  }
}

@media (max-width: #{$breakpoint-sm - 0.02}) {
  .footer__copyright {
    white-space: normal;
  }

  .footer__operational {
    white-space: normal;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}
</style>
