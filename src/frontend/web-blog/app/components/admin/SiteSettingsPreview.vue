<!--
  @file SiteSettingsPreview.vue
  @description 站点与关于资料只读核对，管理员可比较隐藏字段，所有内容从 props 传入。
-->
<template>
  <section class="site-preview" :aria-label="label">
    <h2>{{ label }}</h2>
    <h3>{{ value.name }}</h3>
    <p>{{ value.description }}</p>
    <img
      v-if="value.avatar && !imageFailed"
      :key="value.avatar + imageAttempt"
      :src="value.avatar"
      :alt="value.avatarAlt"
      width="72"
      height="72"
      @error="imageFailed = true"
    />
    <p v-if="imageFailed" role="status">
      头像读取失败
      <button type="button" @click="retryAvatar">重试头像</button>
    </p>
    <p>{{ value.ownerName }} · {{ value.ownerTitle }}</p>
    <p>替代文本：{{ value.avatarAlt || '未填写' }}</p>
    <ul>
      <li v-for="(social, index) in value.socials" :key="index">
        <Icon :name="social.icon" /> {{ social.label }} · {{ social.href }}
      </li>
    </ul>
    <p>公告：{{ value.announcement || '不显示公告' }}</p>
    <p>
      首页 SEO 标题：{{
        value.seoTitle && value.seoTitle !== value.name ? `${value.seoTitle} - ${value.name}` : value.name
      }}
    </p>
    <p>SEO 描述：{{ value.seoDescription || value.description }}</p>
    <details v-if="value.about" class="site-preview__about">
      <summary>关于页完整资料 · {{ value.about.visible ? '整体公开' : '整体未公开' }}</summary>
      <p>以下包含隐藏内容，供管理核对；公开页面还会按栏目和条目显隐过滤。</p>
      <p>详细介绍：{{ value.about.introduction || '未填写' }}</p>
      <p v-if="!value.about.sections.length">尚未填写关于栏目。</p>
      <section v-for="section in value.about.sections" :key="section.kind">
        <h4>{{ aboutSectionLabels[section.kind] }} · {{ section.visible ? '栏目公开' : '栏目隐藏' }}</h4>
        <p v-if="!section.items.length">此栏目尚无条目。</p>
        <ol v-else>
          <li v-for="(item, index) in section.items" :key="index">
            <strong>{{ item.title || '名称未填写' }}</strong> · {{ item.visible ? '条目公开' : '条目隐藏' }}
            <p v-if="item.period">时间或阶段：{{ item.period }}</p>
            <p>说明：{{ item.detail || '未填写' }}</p>
          </li>
        </ol>
      </section>
    </details>
  </section>
</template>
<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { aboutSectionLabels } from '~/features/about/settings'
const props = defineProps<{
  value: Omit<SiteSettingsData, 'revision' | 'updatedAt' | 'announcementUpdatedAt'>
  label: string
}>()
const imageFailed = ref(false)
const imageAttempt = ref(0)
function retryAvatar() {
  imageFailed.value = false
  imageAttempt.value += 1
}
watch(
  () => props.value.avatar,
  () => {
    imageFailed.value = false
  },
)
</script>
<style scoped>
.site-preview {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}
h3 {
  font-weight: 700;
}
p,
ul {
  margin-block: 0.6rem;
}
.site-preview__about {
  margin-block: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
summary {
  cursor: pointer;
  font-weight: 600;
}
.site-preview__about section {
  margin-block: 1rem;
}
.site-preview__about li {
  margin-block: 0.75rem;
}
.site-preview__about p {
  white-space: pre-wrap;
}
img {
  border-radius: 50%;
  object-fit: cover;
}
ul {
  list-style: none;
  padding: 0;
}
</style>
