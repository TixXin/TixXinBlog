/**
 * @file taxonomy-lock.ts
 * @description 专栏/标签更名删除与文章保存共用事务锁，保证引用检查和更新原子性。
 */
import type { EntityManager } from '@mikro-orm/postgresql'

export async function lockTaxonomy(em: EntityManager): Promise<void> {
  await em.execute('select pg_advisory_xact_lock(742911)')
}
