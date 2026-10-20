/**
 * @file setupProfile.test.ts
 * @description 初始化向导第二步的纯函数：MD5 与 Cravatar 地址、字母头像取字与配色、资料校验与请求字段转换
 * @author TixXin
 * @since 2026-10-20
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { md5 } from '../../app/features/setup/md5'
import { LETTER_AVATAR_COLORS, avatarInitial, cravatarUrl, letterAvatarColor } from '../../app/features/setup/avatar'
import { createProfileDraft, localDate, profileRequest, validateProfile } from '../../app/features/setup/profile'

describe('md5', () => {
  it('与标准向量及 Node 实现一致（含多字节字符与跨块长度）', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    for (const text of ['owner@example.com', '中文邮箱@例子.中国', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(130)])
      expect(md5(text)).toBe(createHash('md5').update(text, 'utf8').digest('hex'))
  })

  it('Cravatar 地址按去空白、小写后的邮箱计算，与服务端格式一致', () => {
    expect(cravatarUrl('  Owner@Example.COM ')).toBe(
      `https://cn.cravatar.com/avatar/${createHash('md5').update('owner@example.com').digest('hex')}?s=512&d=identicon`,
    )
  })
})

describe('字母头像', () => {
  it('取第一个字素并转大写，空名称显示问号', () => {
    expect(avatarInitial('tixxin')).toBe('T')
    expect(avatarInitial('  夜读 ')).toBe('夜')
    expect(avatarInitial('👩‍💻 dev')).toBe('👩‍💻')
    expect(avatarInitial('   ')).toBe('?')
  })

  it('同一名称总是同一底色，底色来自固定色板', () => {
    expect(letterAvatarColor('owner')).toBe(letterAvatarColor('owner'))
    expect(LETTER_AVATAR_COLORS).toContain(letterAvatarColor('夜读札记'))
  })
})

describe('validateProfile', () => {
  it('默认草稿通过：博主名留空（沿用登录名）、字母头像、建站日期为今天、允许收录', () => {
    const draft = createProfileDraft('2026-10-20')
    expect(draft).toMatchObject({ ownerName: '', avatarMode: 'letter', launchedAt: '2026-10-20' })
    expect(draft.searchIndexing).toBe(true)
    expect(validateProfile(draft)).toBeNull()
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('逐项定位问题字段', () => {
    const base = createProfileDraft('2026-10-20')
    // 博主名留空不是错误：提交时使用登录名
    expect(validateProfile({ ...base, ownerName: ' ' })).toBeNull()
    expect(validateProfile({ ...base, email: 'nope' })).toEqual({ field: 'email', problem: 'emailInvalid' })
    expect(validateProfile({ ...base, avatarMode: 'upload' })).toEqual({
      field: 'avatar',
      problem: 'avatarUploadMissing',
    })
    expect(validateProfile({ ...base, avatarMode: 'cravatar' })).toEqual({
      field: 'email',
      problem: 'avatarEmailRequired',
    })
    for (const avatarUrl of ['', 'http://a.com/x.png', 'https://u:p@a.com/x.png', 'javascript:alert(1)'])
      expect(validateProfile({ ...base, avatarMode: 'url', avatarUrl })).toEqual({
        field: 'avatarUrl',
        problem: 'avatarUrlInvalid',
      })
    expect(validateProfile({ ...base, launchedAt: '2026/10/20' })).toEqual({
      field: 'launchedAt',
      problem: 'launchedAtInvalid',
    })
    expect(
      validateProfile({
        ...base,
        socials: [
          { icon: 'lucide:github', href: 'https://github.com/a' },
          { icon: 'lucide:rss', href: 'ftp://a.com' },
        ],
      }),
    ).toEqual({ field: 'social-1', problem: 'socialUrlInvalid' })
  })
})

describe('profileRequest', () => {
  it('空字段不提交；沿用登录名；字母头像以图片提交；社交链接按站点语言命名并去掉空行', () => {
    const draft = {
      ...createProfileDraft('2026-10-20'),
      ownerTitle: '  ',
      siteName: ' 夜读札记 ',
      socials: [
        { icon: 'lucide:globe' as const, href: ' https://example.com ' },
        { icon: 'lucide:github' as const, href: '' },
      ],
    }
    expect(
      profileRequest(draft, { username: 'owner', locale: 'zh-CN', letterImage: 'data:image/png;base64,AA' }),
    ).toEqual({
      ownerName: 'owner',
      siteName: '夜读札记',
      launchedAt: '2026-10-20',
      searchIndexing: true,
      avatarSource: 'image',
      avatarImage: 'data:image/png;base64,AA',
      socials: [{ label: '个人网站', href: 'https://example.com', icon: 'lucide:globe' }],
    })
    expect(profileRequest(draft, { username: 'owner', locale: 'en' }).socials).toEqual([
      { label: 'Website', href: 'https://example.com', icon: 'lucide:globe' },
    ])
    // 画布不可用时字母头像为空，不提交头像
    expect(profileRequest(draft, { username: 'owner', locale: 'en' })).not.toHaveProperty('avatarSource')
  })

  it('各头像来源与自定义博主名、关闭收录', () => {
    const base = {
      ...createProfileDraft('2026-10-20'),
      ownerName: ' 小林 ',
      searchIndexing: false,
    }
    const context = { username: 'owner', locale: 'zh-CN' as const }
    expect(
      profileRequest({ ...base, avatarMode: 'upload', avatarUpload: 'data:image/webp;base64,BB' }, context),
    ).toMatchObject({
      ownerName: '小林',
      searchIndexing: false,
      avatarSource: 'image',
      avatarImage: 'data:image/webp;base64,BB',
    })
    expect(profileRequest({ ...base, avatarMode: 'cravatar', email: ' a@b.co ' }, context)).toMatchObject({
      email: 'a@b.co',
      avatarSource: 'cravatar',
    })
    expect(profileRequest({ ...base, avatarMode: 'url', avatarUrl: ' https://a.com/x.png ' }, context)).toMatchObject({
      avatarSource: 'url',
      avatarUrl: 'https://a.com/x.png',
    })
  })
})
