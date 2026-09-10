/** @file 20260910123431_add_gallery_photos.ts @description 增加图库作品及媒体引用，保留现有内容与文件 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260910123431_add_gallery_photos extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "gallery_photo" ("id" serial primary key, "media_id" uuid not null, "title" text not null, "description" text not null default '', "category" text not null default '', "taken_on" date null, "location" text not null default '', "device" text not null default '', "status" text not null default 'draft', "sort_order" int not null default 0, "revision" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    )
    this.addSql(
      `create index "gallery_visibility_order_idx" on "gallery_photo" ("status", "deleted_at", "sort_order", "id");`,
    )
    this.addSql(`alter table "gallery_photo" add constraint "gallery_photo_request_id_unique" unique ("request_id");`)

    this.addSql(
      `alter table "gallery_photo" add constraint "gallery_photo_media_id_foreign" foreign key ("media_id") references "media_asset" ("id") on update cascade on delete restrict;`,
    )

    this.addSql(`alter table "media_reference" add column "gallery_photo_id" int null;`)
    this.addSql(
      `alter table "media_reference" add constraint "media_reference_gallery_photo_id_foreign" foreign key ("gallery_photo_id") references "gallery_photo" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "media_reference" drop constraint "media_reference_gallery_photo_id_foreign";`)

    this.addSql(`drop table "gallery_photo";`)

    this.addSql(`alter table "media_reference" drop column "gallery_photo_id";`)
  }
}
