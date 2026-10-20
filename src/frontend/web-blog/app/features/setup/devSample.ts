/**
 * @file devSample.ts
 * @description 初始化向导的开发示例数据：开发模式下表单留空直接点「下一步」或「创建博主账号」时填入，
 *              便于反复走完流程；只填仍为空或默认值的部分，不覆盖手动输入。生产构建不引用本模块
 * @author TixXin
 * @since 2026-10-20
 */
import type { SupportedLocale } from '~~/i18n/localeOptions'
import { createProfileDraft } from './profile'
import type { SetupProfileDraft } from './types'

/** 开发示例账号；初始化沙盒中会真实创建，填入时以提示告知 */
export const DEV_SETUP_ACCOUNT = { username: 'dev-owner', password: 'dev-password' } as const

/** 账号三项全空时返回示例账号，否则返回 null（按手动输入照常校验） */
export function devAccountSample(input: { username: string; password: string; confirmation: string }) {
  if (input.username || input.password || input.confirmation) return null
  return {
    username: DEV_SETUP_ACCOUNT.username,
    password: DEV_SETUP_ACCOUNT.password,
    confirmation: DEV_SETUP_ACCOUNT.password,
  }
}

/** 第二步是否仍为默认值：建站日期按当前值比较，改过头像方式或任一字段都算已编辑 */
export function isProfileUntouched(draft: SetupProfileDraft): boolean {
  return JSON.stringify(draft) === JSON.stringify(createProfileDraft(draft.launchedAt))
}

const SAMPLES: Record<SupportedLocale, Pick<SetupProfileDraft, 'ownerTitle' | 'siteName' | 'description'>> = {
  'zh-CN': {
    ownerTitle: '全栈开发者',
    siteName: '夜读札记',
    description: '记录写代码、读书与日常生活的点滴。',
  },
  en: {
    ownerTitle: 'Full-stack developer',
    siteName: 'Night Notes',
    description: 'Notes on code, books and everyday life.',
  },
}

/** 第二步示例资料：字母头像、示例头衔与邮箱、站点名称与简介、一条 GitHub 链接 */
export function devProfileSample(draft: SetupProfileDraft, locale: SupportedLocale): SetupProfileDraft {
  return {
    ...draft,
    ...SAMPLES[locale],
    avatarMode: 'letter',
    email: `${DEV_SETUP_ACCOUNT.username}@example.com`,
    socials: draft.socials.map((link) =>
      link.icon === 'lucide:github' ? { ...link, href: `https://github.com/${DEV_SETUP_ACCOUNT.username}` } : link,
    ),
  }
}
