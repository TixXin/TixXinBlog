/** @file 20260910123940_add_gallery_settings.ts @description 增加独立器材配置，初始为空且不改写站点资料 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260910123940_add_gallery_settings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "gallery_settings" ("id" text not null, "revision" int not null default 0, "gear" jsonb not null default '[]', "updated_at" timestamptz not null, constraint "gallery_settings_pkey" primary key ("id"));`,
    )
    this.addSql(`insert into "gallery_settings" ("id", "gear", "updated_at") values ('default', '[]', now());`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table "gallery_settings";`)
  }
}
