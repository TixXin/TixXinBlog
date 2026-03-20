/**
 * @file types.ts
 * @description 关于页模块类型定义
 * @author TixXin
 * @since 2025-03-17
 */

export interface SocialLink {
  icon: string
  label: string
  href: string
  primary?: boolean
}

export interface Profile {
  name: string
  avatar: string
  bio: string
  socials: SocialLink[]
}

export interface SkillItem {
  name: string
  percent: number
}

export interface ExperienceItem {
  period: string
  title: string
  description: string
}

export interface ContactItem {
  icon: string
  type: string
  value: string
  href: string
}

export interface HobbyItem {
  icon: string
  label: string
}

export interface BookItem {
  title: string
  author: string
}
