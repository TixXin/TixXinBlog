<!--
  @file about.vue
  @description 关于我页面，展示个人信息、技能、经历和联系方式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner">
    <CommonCustomScrollbar class="about-body" viewport-class="about-viewport" :show-back-to-top="false" primary>
      <AboutHero :profile="profile" />
      <p v-if="error" role="alert">{{ error }} <button type="button" @click="refresh">重试</button></p>
      <AboutProfileContent :value="settings.about" />
      <AboutContactCards v-if="contacts.length" :contacts="contacts" />
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <AboutDonateCard />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { settings, error, refresh } = useSiteSettings()

useSeoMeta({
  title: '关于我',
  description: () => settings.value.ownerTitle || settings.value.description,
  ogTitle: () => `关于我 - ${settings.value.name}`,
  ogDescription: () => settings.value.ownerTitle || settings.value.description,
})

const { ownerCard } = useSiteInfo()
const profile = computed(() => ({
  name: ownerCard.value.name,
  avatar: ownerCard.value.avatar || '/avatar.svg',
  bio: ownerCard.value.title,
  socials: ownerCard.value.socials,
}))
const contacts = computed(() =>
  ownerCard.value.socials.map((link) => ({
    icon: link.icon,
    type: link.label,
    value: link.href.replace(/^mailto:|^https?:\/\//, ''),
    href: link.href,
  })),
)
</script>

<style lang="scss" scoped>
.about-body {
  flex: 1;
  padding: 0;
}

:deep(.about-viewport) {
  padding: 1rem 2rem 2rem;
}
</style>
