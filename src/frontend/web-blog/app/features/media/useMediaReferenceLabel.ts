/** @file useMediaReferenceLabel.ts @description 引用条目的类型标签，随界面语言切换 */
import type { Translate } from '~/utils/format'
import { mediaReferenceLabel } from './library'
import type { MediaReferences } from './types'

export function useMediaReferenceLabel() {
  const { t } = useI18n()
  const translate: Translate = (key, params) => (params ? t(key, params) : t(key))
  return (item: MediaReferences['items'][number]) => mediaReferenceLabel(item, translate)
}
