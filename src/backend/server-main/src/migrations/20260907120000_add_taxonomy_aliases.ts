/**
 * @file 20260907120000_add_taxonomy_aliases.ts
 * @description 为后续目录更名建立别名映射，不推断或覆盖历史名称。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907120000_add_taxonomy_aliases extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "taxonomy_alias" ("id" serial primary key, "kind" text not null, "alias" text not null, "target" text not null);',
    )
    this.addSql(
      'alter table "taxonomy_alias" add constraint "taxonomy_alias_kind_alias_unique" unique ("kind", "alias");',
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table "taxonomy_alias";')
  }
}
