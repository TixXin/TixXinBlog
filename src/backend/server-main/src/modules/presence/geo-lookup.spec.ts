/** @file geo-lookup.spec.ts @description 地区结果解析、IP 规范化与打码，以及查询器缺失或出错时按未知处理 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GeoLookup, maskIp, normalizeIp, parseRegion, UNKNOWN_LOCATION } from './geo-lookup'

describe('地区结果解析', () => {
  it('取 ISO 国家代码、省份与城市，0 视为空', () => {
    expect(parseRegion('中国|广东省|深圳市|电信|CN')).toEqual({ country: 'CN', region: '广东省', city: '深圳市' })
    expect(parseRegion('United States|California|0|0|US')).toEqual({ country: 'US', region: 'California', city: '' })
    expect(parseRegion('中国|台湾省|台北市|0|CN')).toEqual({ country: 'CN', region: '台湾省', city: '台北市' })
  })
  it('保留地址、格式不对或缺少代码时为未知', () => {
    for (const raw of ['Reserved|Reserved|Reserved|0|0|', '0|0|0|0|0', '中国|广东省', '', undefined])
      expect(parseRegion(raw)).toEqual(UNKNOWN_LOCATION)
  })
})

describe('IP 规范化与打码', () => {
  it('去掉 IPv4 映射前缀，拒绝非法地址', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toEqual({ ip: '1.2.3.4', version: 4 })
    expect(normalizeIp('2408:8456::1')).toEqual({ ip: '2408:8456::1', version: 6 })
    expect(normalizeIp('1.2.3')).toBeNull()
    expect(normalizeIp(undefined)).toBeNull()
  })
  it('IPv4 留前三段，IPv6 展开后留前三组', () => {
    expect(maskIp('1.207.89.207')).toBe('1.207.89.*')
    expect(maskIp('::ffff:202.96.128.86')).toBe('202.96.128.*')
    expect(maskIp('2408:8456:a1:2f::1')).toBe('2408:8456:a1::*')
    expect(maskIp('2408::1')).toBe('2408:0:0::*')
    expect(maskIp('2001:0db8:0000:0001:0000:0000:0000:0001')).toBe('2001:db8:0::*')
    expect(maskIp('not-an-ip')).toBe('')
  })
})

describe('地区查询', () => {
  it('按版本选择查询器并解析结果', async () => {
    const lookup = GeoLookup.withSearchers({
      4: { search: async () => '中国|贵州省|黔东南|电信|CN' },
      6: { search: () => '日本|东京都|0|0|JP' },
    })
    expect(await lookup.locate('1.207.89.207')).toEqual({ country: 'CN', region: '贵州省', city: '黔东南' })
    expect(await lookup.locate('2400:4050::1')).toEqual({ country: 'JP', region: '东京都', city: '' })
  })
  it('缺少数据文件、查询出错或地址非法时为未知，不抛错', async () => {
    const lookup = GeoLookup.withSearchers({
      4: {
        search: async () => {
          throw new Error('broken')
        },
      },
    })
    expect(await lookup.locate('1.2.3.4')).toEqual(UNKNOWN_LOCATION)
    expect(await lookup.locate('2408::1')).toEqual(UNKNOWN_LOCATION)
    expect(await lookup.locate('bad')).toEqual(UNKNOWN_LOCATION)
  })
})

describe('数据版本', () => {
  it('Dockerfile 下载的版本与校验值和 geo-data.json 一致', () => {
    const root = join(__dirname, '../../..')
    const data = JSON.parse(readFileSync(join(root, 'scripts/geo-data.json'), 'utf8')) as {
      commit: string
      files: Record<string, string>
    }
    const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8')
    for (const [name, sha] of Object.entries(data.files)) {
      expect(dockerfile).toContain(`--checksum=sha256:${sha}`)
      expect(dockerfile).toContain(`/${data.commit}/data/${name}`)
    }
  })
})
