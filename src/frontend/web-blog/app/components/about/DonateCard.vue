<!--
  @file DonateCard.vue
  @description 支持方式卡片，用于关于页和文章详情页侧栏；内容来自后台“支持方式”，未开启或没有可用方式时不渲染
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section v-if="support" class="card donate-card" aria-labelledby="donate-card-title">
    <div class="donate-card__decor" />
    <div class="donate-card__content">
      <h2 id="donate-card-title" class="donate-card__title">
        <span class="donate-card__icon">
          <Icon name="lucide:coffee" size="16" />
        </span>
        {{ $t('misc.about.support.title') }}
      </h2>
      <p class="donate-card__desc">{{ support.message || $t('misc.about.support.description') }}</p>
      <ul class="donate-card__methods" :aria-label="$t('misc.about.support.methods')">
        <li v-for="(method, index) in support.methods" :key="`${index}-${method.label}`" class="donate-card__method">
          <CommonContentImage
            v-if="method.image"
            :src="method.image"
            :alt="$t('misc.about.support.imageAlt', { label: method.label })"
            class="donate-card__qr"
            width="160"
            height="160"
          />
          <a v-if="method.url" :href="method.url" class="donate-card__link" target="_blank" rel="noopener"
            >{{ method.label }}<span class="sr-only">{{ $t('misc.about.support.opensNewTab') }}</span></a
          >
          <span v-else class="donate-card__label">{{ method.label }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { localizeAbout, publicAbout } from '~/features/about/settings'

const { settings } = useSiteSettings()
const { locale } = useI18n()
const support = computed(() => localizeAbout(publicAbout(settings.value.about), locale.value).support)
</script>

<style lang="scss" scoped>
.donate-card {
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
}

.donate-card__decor {
  position: absolute;
  right: -1.5rem;
  top: -1.5rem;
  width: 6rem;
  height: 6rem;
  background: rgba(226, 232, 240, 0.4);
  border-radius: 50%;
  filter: blur(24px);

  .dark & {
    background: rgba(71, 85, 105, 0.2);
  }
}

.donate-card__content {
  position: relative;
  z-index: 1;
}

.donate-card__title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.donate-card__icon {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.donate-card__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.donate-card__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.donate-card__method {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.donate-card__qr {
  width: 7.5rem;
  height: 7.5rem;
  border-radius: $radius-sm;
  border: 1px solid var(--border);
  background: #fff;
  object-fit: contain;
}

.donate-card__link {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: $radius-md;
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  background: var(--accent-action);
  color: #fff;

  &:hover {
    opacity: 0.9;
  }
}

.donate-card__label {
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
