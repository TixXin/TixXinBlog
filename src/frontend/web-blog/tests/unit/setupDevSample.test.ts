/**
 * @file setupDevSample.test.ts
 * @description 初始化向导开发示例数据：只在账号三项全空、第二步仍为默认值时填入，不覆盖手动输入
 * @author TixXin
 * @since 2026-10-20
 */
import { describe, expect, it } from 'vitest'
import {
  DEV_SETUP_ACCOUNT,
  devAccountSample,
  devProfileSample,
  isProfileUntouched,
} from '../../app/features/setup/devSample'
import { createProfileDraft, profileRequest, validateProfile } from '../../app/features/setup/profile'

describe('devAccountSample', () => {
  it('三项全空时给出示例账号，两次密码一致且满足长度要求', () => {
    const sample = devAccountSample({ username: '', password: '', confirmation: '' })
    expect(sample).toEqual({
      username: DEV_SETUP_ACCOUNT.username,
      password: DEV_SETUP_ACCOUNT.password,
      confirmation: DEV_SETUP_ACCOUNT.password,
    })
    expect(sample!.password.length).toBeGreaterThanOrEqual(6)
  })

  it('任一项已填写时不填入，按手动输入照常校验', () => {
    expect(devAccountSample({ username: 'me', password: '', confirmation: '' })).toBeNull()
    expect(devAccountSample({ username: '', password: 'x', confirmation: '' })).toBeNull()
    expect(devAccountSample({ username: '', password: '', confirmation: 'x' })).toBeNull()
  })
})

describe('devProfileSample', () => {
  it('默认草稿视为未编辑；改过任一字段或头像方式即视为已编辑', () => {
    const draft = createProfileDraft('2026-10-20')
    expect(isProfileUntouched(draft)).toBe(true)
    expect(isProfileUntouched({ ...draft, ownerTitle: '写字的人' })).toBe(false)
    expect(isProfileUntouched({ ...draft, avatarMode: 'cravatar' })).toBe(false)
    expect(isProfileUntouched({ ...draft, searchIndexing: false })).toBe(false)
    expect(isProfileUntouched({ ...draft, launchedAt: '2020-01-01' })).toBe(true)
  })

  it('示例资料按站点语言给出、通过前端校验，并只填 GitHub 一条社交链接', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const sample = devProfileSample(createProfileDraft('2026-10-20'), locale)
      expect(validateProfile(sample)).toBeNull()
      const request = profileRequest(sample, { username: DEV_SETUP_ACCOUNT.username, locale })
      expect(request).toMatchObject({ email: 'dev-owner@example.com', launchedAt: '2026-10-20' })
      expect(request.socials).toEqual([
        { label: 'GitHub', href: 'https://github.com/dev-owner', icon: 'lucide:github' },
      ])
    }
    expect(devProfileSample(createProfileDraft(), 'zh-CN').siteName).toBe('夜读札记')
    expect(devProfileSample(createProfileDraft(), 'en').siteName).toBe('Night Notes')
  })
})
