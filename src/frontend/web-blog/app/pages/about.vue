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
      <p class="about-demo-note">
        以下技能、经历、兴趣与书单为界面示例，尚未作为博主履历确认。联系方式使用本站公开资料。
      </p>
      <AboutSkillBars :skills="skills" />
      <AboutExperienceTimeline :experiences="experiences" />
      <AboutContactCards :contacts="contacts" />
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <AboutHobbyCard :hobbies="hobbies" />
          <AboutReadingCard :books="readings" />
          <AboutDonateCard />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockSkills, mockExperiences, mockHobbies, mockReadings } from '~/features/about/mock'

useSeoMeta({
  title: '关于我',
  description: '了解 TixXin — 个人简介、技能栈、职业经历与联系方式',
  ogTitle: '关于我 - TixXin Blog',
  ogDescription: '了解 TixXin — 个人简介、技能栈、职业经历与联系方式',
})

const { ownerCard } = useSiteInfo()
const profile = computed(() => ({
  name: ownerCard.value.name,
  avatar: ownerCard.value.avatar || '/avatar.svg',
  bio: ownerCard.value.title,
  socials: ownerCard.value.socials,
}))
const skills = mockSkills
const experiences = mockExperiences
const contacts = computed(() =>
  ownerCard.value.socials.map((link) => ({
    icon: link.icon,
    type: link.label,
    value: link.href.replace(/^mailto:|^https?:\/\//, ''),
    href: link.href,
  })),
)
const hobbies = mockHobbies
const readings = mockReadings
</script>

<style lang="scss" scoped>
.about-demo-note {
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  font-size: 0.875rem;
  color: var(--text-soft);
  line-height: 1.7;
}
.about-body {
  flex: 1;
  padding: 0;
}

:deep(.about-viewport) {
  padding: 1rem 2rem 2rem;
}
</style>
