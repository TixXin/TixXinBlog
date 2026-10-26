/** @file editorLabels.ts @description 站点设置三方合并冲突字段的显示名：按字段路径取文案，未知路径回落通用名称 */
import { aboutSectionLabel, aboutSectionLabelKeys } from '../about/settings'
import type { Translate } from '~/utils/format'

/** 站点编辑器文案的命名空间 */
export const SITE_EDITOR_I18N = 'admin-system.site.editor'

const FIELDS = [
  'name',
  'description',
  'ownerName',
  'ownerTitle',
  'avatar',
  'avatarAlt',
  'seoTitle',
  'seoDescription',
  'searchIndexing',
  'announcement',
  'socials',
  'presenceLabel',
  'presenceSignature',
  'launchedAt',
  'presenceStatus',
  'navigation',
  'footerLinks',
  'quotes',
  'icpNumber',
  'icpUrl',
  'copyright',
]

export function siteConflictLabels(paths: string[], t: Translate): string {
  const S = SITE_EDITOR_I18N
  const labels: Record<string, string> = {
    ...Object.fromEntries(FIELDS.map((field) => [field, t(`${S}.fields.${field}`)])),
    'about.visible': t(`${S}.fields.aboutVisible`),
    'about.introduction': t(`${S}.fields.aboutIntroduction`),
    'about.sections.order': t(`${S}.fields.aboutOrder`),
    ...Object.fromEntries(
      (Object.keys(aboutSectionLabelKeys) as (keyof typeof aboutSectionLabelKeys)[]).map((kind) => [
        `about.${kind}`,
        t(`${S}.fields.aboutSection`, { section: aboutSectionLabel(kind, t) }),
      ]),
    ),
  }
  return paths.map((path) => labels[path] ?? t(`${S}.fields.fallback`)).join(t(`${S}.fields.separator`))
}
