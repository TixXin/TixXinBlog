/**
 * @file 20260907150000_add_post_trash.ts
 * @description 新增文章回收状态，既有文章保持原状。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907150000_add_post_trash extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "post" add column "deleted_at" timestamptz null;')
    this.addSql('create index "post_deleted_at_index" on "post" ("deleted_at");')
  }
  override async down(): Promise<void> {
    this.addSql('drop index "post_deleted_at_index";')
    this.addSql('alter table "post" drop column "deleted_at";')
  }
}
