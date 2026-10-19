/**
 * @file wallpapers.ts
 * @description 内置壁纸图库（Unsplash 托管）
 * @author TixXin
 * @since 2026-04-15
 */

export interface BuiltinWallpaper {
  id: string
  /** 名称的字典 key（misc.tab.wallpapers.*），展示时按当前语言翻译 */
  nameKey: string
  url: string
  thumb: string
  /** 是否适合深色主题（浅色照片建议亮模式） */
  darkFriendly?: boolean
}

const u = (id: string, size = 2400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${size}&q=80`

export const builtinWallpapers: BuiltinWallpaper[] = [
  {
    id: 'mountain-dawn',
    nameKey: 'misc.tab.wallpapers.mountainDawn',
    url: u('photo-1506905925346-21bda4d32df4'),
    thumb: u('photo-1506905925346-21bda4d32df4', 480),
    darkFriendly: true,
  },
  {
    id: 'forest-fog',
    nameKey: 'misc.tab.wallpapers.forestFog',
    url: u('photo-1448375240586-882707db888b'),
    thumb: u('photo-1448375240586-882707db888b', 480),
    darkFriendly: true,
  },
  {
    id: 'ocean-horizon',
    nameKey: 'misc.tab.wallpapers.oceanHorizon',
    url: u('photo-1505142468610-359e7d316be0'),
    thumb: u('photo-1505142468610-359e7d316be0', 480),
  },
  {
    id: 'desert-dunes',
    nameKey: 'misc.tab.wallpapers.desertDunes',
    url: u('photo-1509316975850-ff9c5deb0cd9'),
    thumb: u('photo-1509316975850-ff9c5deb0cd9', 480),
  },
  {
    id: 'city-night',
    nameKey: 'misc.tab.wallpapers.cityNight',
    url: u('photo-1519501025264-65ba15a82390'),
    thumb: u('photo-1519501025264-65ba15a82390', 480),
    darkFriendly: true,
  },
  {
    id: 'aurora',
    nameKey: 'misc.tab.wallpapers.aurora',
    url: u('photo-1483347756197-71ef80e95f73'),
    thumb: u('photo-1483347756197-71ef80e95f73', 480),
    darkFriendly: true,
  },
  {
    id: 'pastel-sky',
    nameKey: 'misc.tab.wallpapers.pastelSky',
    url: u('photo-1513151233558-d860c5398176'),
    thumb: u('photo-1513151233558-d860c5398176', 480),
  },
  {
    id: 'abstract-gradient',
    nameKey: 'misc.tab.wallpapers.abstractGradient',
    url: u('photo-1557672172-298e090bd0f1'),
    thumb: u('photo-1557672172-298e090bd0f1', 480),
  },
  {
    id: 'deep-space',
    nameKey: 'misc.tab.wallpapers.deepSpace',
    url: u('photo-1419242902214-272b3f66ee7a'),
    thumb: u('photo-1419242902214-272b3f66ee7a', 480),
    darkFriendly: true,
  },
  {
    id: 'minimal-white',
    nameKey: 'misc.tab.wallpapers.minimalWhite',
    url: u('photo-1497864149936-d3163f0c0f4b'),
    thumb: u('photo-1497864149936-d3163f0c0f4b', 480),
  },
]

export function findWallpaper(id: string | undefined): BuiltinWallpaper | null {
  if (!id) return null
  return builtinWallpapers.find((w) => w.id === id) ?? null
}
