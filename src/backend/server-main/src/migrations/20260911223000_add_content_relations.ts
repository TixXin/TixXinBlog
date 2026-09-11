/** @file 20260911223000_add_content_relations.ts @description 三域有向有序内容关联；旧记录缺省为空且不改媒体引用。 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260911223000_add_content_relations extends Migration {
  override up(): void {
    for (const table of ['post', 'project', 'gallery_photo'])
      this.addSql(`alter table "${table}" add column "related_content" jsonb not null default '[]'::jsonb;`)
  }
  override down(): void {
    for (const table of ['post', 'project', 'gallery_photo'])
      this.addSql(`alter table "${table}" drop column "related_content";`)
  }
}
