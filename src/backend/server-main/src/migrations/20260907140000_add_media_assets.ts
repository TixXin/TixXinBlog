/**
 * @file 20260907140000_add_media_assets.ts
 * @description 媒体元信息表，新增表不改动既有内容和图片地址。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907140000_add_media_assets extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "media_asset" ("id" uuid not null, "original_name" text not null, "storage_key" text not null, "mime_type" text not null, "byte_size" int not null, "width" int not null, "height" int not null, "sha256" text not null, "alt" text not null default \'\', "created_at" timestamptz not null, "deleted_at" timestamptz null, constraint "media_asset_pkey" primary key ("id"));',
    )
    this.addSql(
      'create table "media_reference" ("id" serial primary key, "asset_id" uuid not null, "source_key" text not null, "kind" text not null, "post_id" int null, "flash_note_id" text null, "revision" int null);',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_asset_id_source_key_unique" unique ("asset_id", "source_key");',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_asset_id_foreign" foreign key ("asset_id") references "media_asset" ("id") on update cascade on delete restrict;',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_flash_note_id_foreign" foreign key ("flash_note_id") references "flash_note" ("id") on update cascade on delete cascade;',
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table "media_reference";')
    this.addSql('drop table "media_asset";')
  }
}
