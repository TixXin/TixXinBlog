// @vitest-environment node
/** @file releaseVersions.test.ts @description 后台版本信息：版本比较、按通道筛选 Release、迁移识别与相对链接改写的纯逻辑回归。 */
import { describe, expect, it } from 'vitest'
import {
  absolutizeLinks,
  compareVersions,
  mentionsMigration,
  summarizeReleases,
  type GithubRelease,
} from '../../server/utils/releaseVersions'

const release = (tag: string, extra: Partial<GithubRelease> = {}): GithubRelease => ({
  tag_name: tag,
  prerelease: tag.includes('-'),
  published_at: '2026-11-05T16:00:00Z',
  html_url: `https://github.com/TixXin/TixXinBlog/releases/tag/${tag}`,
  body: '',
  ...extra,
})

describe('版本比较', () => {
  it('按主次修订号与预发布序号比较，正式版高于同号预发布', () => {
    expect(compareVersions('0.5.2', '0.5.2-beta.6')).toBeGreaterThan(0)
    expect(compareVersions('0.5.2-beta.10', '0.5.2-beta.9')).toBeGreaterThan(0)
    expect(compareVersions('v0.5.2-beta.6', '0.5.2-beta.6')).toBe(0)
    expect(compareVersions('0.6.0-beta.1', '0.5.9')).toBeGreaterThan(0)
    expect(compareVersions('0.5.1', '0.5.10')).toBeLessThan(0)
    expect(compareVersions('0.5.2-alpha.1', '0.5.2-beta.1')).toBeLessThan(0)
    expect(compareVersions('不是版本', '0.0.1')).toBeLessThan(0)
  })
})

describe('Release 整理', () => {
  const releases = [
    release('v0.5.1'),
    release('v0.5.2-beta.6'),
    release('v0.5.2-beta.7', { body: '### 升级说明\n\n- 含一项数据库迁移：新增表' }),
    release('v0.5.2-beta.8', { draft: true }),
    release('nightly'),
  ]

  it('测试版站点看到测试版与正式版，按版本倒序，标出当前、更新与最新', () => {
    const summary = summarizeReleases(releases, '0.5.2-beta.6', { checkedAt: '2026-11-06T00:00:00Z' })
    expect(summary.channel).toBe('beta')
    expect(summary.items.map((item) => item.version)).toEqual(['0.5.2-beta.7', '0.5.2-beta.6', '0.5.1'])
    expect(summary.items.map((item) => [item.current, item.newer])).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ])
    expect(summary.latest).toBe('0.5.2-beta.7')
    expect(summary.items[0]!.migration).toBe(true)
  })

  it('正式版站点只提示正式版，不把测试版当成新版本', () => {
    const summary = summarizeReleases(releases, '0.5.1')
    expect(summary.channel).toBe('stable')
    expect(summary.items.map((item) => item.version)).toEqual(['0.5.1'])
    expect(summary.latest).toBeNull()
    const upgraded = summarizeReleases([...releases, release('v0.5.2')], '0.5.1')
    expect(upgraded.latest).toBe('0.5.2')
  })

  it('未注入版本（本机开发）时列出正式版，不提示升级', () => {
    const summary = summarizeReleases(releases, null, { error: true })
    expect(summary.current).toBeNull()
    expect(summary.latest).toBeNull()
    expect(summary.error).toBe(true)
  })
})

describe('更新说明', () => {
  it('只把「含 N 项数据库迁移」识别为迁移', () => {
    expect(mentionsMigration('- 含三项数据库迁移（post_view …）')).toBe(true)
    expect(mentionsMigration('- 环境文件与编排不变，不含数据库迁移')).toBe(false)
  })

  it('仓库相对链接指向该版本的 GitHub 文件，外链与锚点保持不变', () => {
    expect(absolutizeLinks('见[部署](docs/deployment.md)与[说明](./README.md)', 'TixXin/TixXinBlog', 'v0.5.2')).toBe(
      '见[部署](https://github.com/TixXin/TixXinBlog/blob/v0.5.2/docs/deployment.md)与[说明](https://github.com/TixXin/TixXinBlog/blob/v0.5.2/README.md)',
    )
    const untouched = '[官网](https://example.com) [锚点](#升级) [邮件](mailto:a@example.com) [站内](/about)'
    expect(absolutizeLinks(untouched, 'TixXin/TixXinBlog', 'v0.5.2')).toBe(untouched)
  })
})
