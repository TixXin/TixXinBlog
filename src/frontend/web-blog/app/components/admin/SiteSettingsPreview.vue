<!--
  @file SiteSettingsPreview.vue
  @description 公开站点资料预览，所有内容从 props 传入。
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
  </section>
</template>
<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
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
img {
  border-radius: 50%;
  object-fit: cover;
}
ul {
  list-style: none;
  padding: 0;
}
</style>
