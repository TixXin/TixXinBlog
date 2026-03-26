<!--
  @file about.vue
  @description 关于我页面，展示个人信息、技能、经历和联系方式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner">
    <CommonCustomScrollbar class="about-body" viewport-class="about-viewport" show-back-to-top>
      <AboutHero :profile="profile" />
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
import {
  mockProfile,
  mockSkills,
  mockExperiences,
  mockContacts,
  mockHobbies,
  mockReadings,
} from '~/features/about/mock'

useSeoMeta({
  title: '关于我',
  description: '了解 TixXin — 个人简介、技能栈、职业经历与联系方式',
  ogTitle: '关于我 - TixXin Blog',
  ogDescription: '了解 TixXin — 个人简介、技能栈、职业经历与联系方式',
})

const profile = mockProfile
const skills = mockSkills
const experiences = mockExperiences
const contacts = mockContacts
const hobbies = mockHobbies
const readings = mockReadings
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
