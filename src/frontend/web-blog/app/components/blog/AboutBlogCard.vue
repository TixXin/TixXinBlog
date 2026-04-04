<!--
  @file AboutBlogCard.vue
  @description 首页关于博客卡片
  @author TixXin
  @since 2026-04-04
-->

<template>
  <div class="about-blog">
    <div class="about-blog__header">
      <h2 class="about-blog__title">
        <Icon name="lucide:info" size="18" class="about-blog__icon" />
        关于本站
      </h2>
    </div>

    <div class="about-blog__content">
      <p>欢迎来到 TixXin Blog！这是一个基于 Nuxt 4 + Vue 3 构建的现代化博客。</p>
      <p>
        本站采用了自研的主题引擎
        <code>@tixxin/nuxt-theme-engine</code
        >，支持多套布局主题的无缝切换。你可以点击右下角（或侧边栏）的设置按钮，体验不同的主题和动画效果。
      </p>

      <div class="about-blog__actions">
        <NuxtLink to="/about" class="btn-primary">
          了解更多
          <Icon name="lucide:arrow-right" size="16" />
        </NuxtLink>
        <a href="https://github.com/AYumeRNA/TixXinBlog" target="_blank" rel="noopener noreferrer" class="btn-outline">
          <Icon name="lucide:github" size="16" />
          查看源码
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.about-blog {
  background: var(--surface-1);
  border-radius: $radius-lg;
  border: 1px solid var(--border-soft);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-card);
}

.about-blog__header {
  margin-bottom: 1.25rem;
}

.about-blog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.about-blog__icon {
  color: var(--accent);
}

.about-blog__content {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--text-muted);

  p {
    margin: 0 0 1rem;

    &:last-of-type {
      margin-bottom: 1.5rem;
    }
  }

  code {
    background: var(--surface-2);
    padding: 0.125rem 0.375rem;
    border-radius: $radius-sm;
    font-size: 0.875em;
    color: var(--accent);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
}

.about-blog__actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--text-main);
  color: var(--bg);
  border-radius: $radius-md;
  font-weight: 500;
  transition: $transition-colors;
  text-decoration: none;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  font-weight: 500;
  transition: $transition-colors;
  text-decoration: none;

  &:hover {
    background: var(--surface-2);
    border-color: var(--border-hover);
  }
}
</style>
