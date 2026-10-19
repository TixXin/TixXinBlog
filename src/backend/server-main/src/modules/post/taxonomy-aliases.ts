/**
 * @file taxonomy-aliases.ts
 * @description 在目录事务锁内维护并解析历史名称，目标已删除时拒绝复活。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { TaxonomyAlias } from '../../entities/taxonomy-alias.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { msg } from '../../common/i18n'

export async function registerTaxonomyRename(
  em: EntityManager,
  kind: 'folders' | 'tags',
  oldLabel: string,
  newLabel: string,
) {
  await em.nativeUpdate(TaxonomyAlias, { kind, target: oldLabel }, { target: newLabel })
  em.create(TaxonomyAlias, { kind, alias: oldLabel, target: newLabel })
}
export async function canonicalTaxonomyLabel(
  em: EntityManager,
  kind: 'folders' | 'tags',
  label: string,
): Promise<string> {
  const entry = await em.findOne(TaxonomyAlias, { kind, alias: label })
  if (!entry) return label
  const exists =
    kind === 'folders'
      ? await em.count(PostFolder, { label: entry.target })
      : await em.count(PostTag, { label: entry.target })
  if (!exists) throw new ConflictException(msg('post.taxonomyAliasTargetDeleted'))
  return entry.target
}
