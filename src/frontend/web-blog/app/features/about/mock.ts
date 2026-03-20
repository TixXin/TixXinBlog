/**
 * @file mock.ts
 * @description 关于页模块 mock 数据
 * @author TixXin
 * @since 2025-03-17
 */

import type { Profile, SkillItem, ExperienceItem, ContactItem, HobbyItem, BookItem } from './types'

export const mockProfile: Profile = {
  name: 'TixXin',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  bio: '一名热爱前端开发的工程师，专注于 Web 技术和用户体验。喜欢探索新技术，热衷于用代码创造美好的数字产品。工作之余喜欢摄影、阅读和旅行，相信技术与生活可以完美融合。',
  socials: [
    { icon: 'lucide:github', label: 'GitHub', href: '#', primary: true },
    { icon: 'lucide:mail', label: 'Email', href: '#' },
    { icon: 'lucide:twitter', label: 'Twitter', href: '#' },
  ],
}

export const mockSkills: SkillItem[] = [
  { name: 'HTML / CSS', percent: 95 },
  { name: 'JavaScript / TypeScript', percent: 90 },
  { name: 'Vue.js / React', percent: 85 },
  { name: 'Node.js / Express', percent: 70 },
  { name: 'Tailwind CSS', percent: 88 },
  { name: 'Docker / CI/CD', percent: 55 },
]

export const mockExperiences: ExperienceItem[] = [
  {
    period: '2022 - 至今',
    title: '高级前端工程师 · 某科技公司',
    description: '负责公司核心 B 端产品的前端架构设计与开发，主导了从 Vue2 到 Vue3 的全面迁移，搭建了组件库和 CI/CD 流程，团队规模从 3 人扩展到 8 人。',
  },
  {
    period: '2020 - 2022',
    title: '前端工程师 · 某互联网创业公司',
    description: '参与了多个 C 端产品的开发，包括电商小程序、营销活动页面和管理后台。期间深入学习了 React 生态和 TypeScript，开始在团队中推广代码规范和自动化测试。',
  },
  {
    period: '2019 - 2020',
    title: '初级前端开发 · 某外包公司',
    description: '入行的第一份工作，主要负责各类官网和展示型网站的前端开发。在这里打下了 HTML/CSS/JS 的扎实基础，学会了如何与设计师和后端开发高效协作。',
  },
  {
    period: '2015 - 2019',
    title: '计算机科学与技术 · 某大学',
    description: '本科期间系统学习了计算机基础知识，大二开始自学前端开发，大三获得 ACM 区域赛铜牌，毕业设计是一个基于 Vue 的在线协作白板系统。',
  },
]

export const mockContacts: ContactItem[] = [
  { icon: 'lucide:mail', type: 'Email', value: 'TixXin@example.com', href: 'mailto:TixXin@example.com' },
  { icon: 'lucide:github', type: 'GitHub', value: 'github.com/TixXin', href: '#' },
  { icon: 'lucide:twitter', type: 'Twitter / X', value: '@TixXin_dev', href: '#' },
  { icon: 'lucide:message-circle', type: '微信', value: 'TixXin_wechat', href: '#' },
]

export const mockHobbies: HobbyItem[] = [
  { icon: 'lucide:camera', label: '摄影' },
  { icon: 'lucide:book-open', label: '阅读' },
  { icon: 'lucide:plane', label: '旅行' },
  { icon: 'lucide:gamepad-2', label: '游戏' },
  { icon: 'lucide:music', label: '音乐' },
  { icon: 'lucide:coffee', label: '咖啡' },
]

export const mockReadings: BookItem[] = [
  { title: '代码整洁之道', author: 'Robert C. Martin' },
  { title: '设计心理学', author: 'Donald Norman' },
  { title: '深入浅出 Vue.js', author: '刘博文' },
]
