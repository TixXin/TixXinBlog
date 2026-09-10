/** @file 20260910155200_add_friend_links.ts @description 增加真实友链、独立规则与媒体引用，保留同址导入草稿及既有业务 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260910155200_add_friend_links extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "friend_link" ("id" serial primary key, "name" text not null, "description" text not null default '', "url" text not null, "logo_media_id" uuid null, "logo_url" text null, "status" text not null default 'draft', "is_featured" boolean not null default false, "sort_order" int not null default 0, "revision" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    )
    this.addSql(
      `create index "friend_link_visibility_order_idx" on "friend_link" ("status", "deleted_at", "is_featured", "sort_order", "id");`,
    )
    this.addSql(
      `create unique index "friend_link_public_url_unique" on "friend_link" ("url") where "status" = 'published' and "deleted_at" is null;`,
    )
    this.addSql(`alter table "friend_link" add constraint "friend_link_request_id_unique" unique ("request_id");`)
    this.addSql(
      `alter table "friend_link" add constraint "friend_link_logo_media_id_foreign" foreign key ("logo_media_id") references "media_asset" ("id") on update cascade on delete restrict;`,
    )
    this.addSql(
      `create table "link_settings" ("id" text primary key, "revision" int not null default 0, "rules" jsonb not null default '[]', "updated_at" timestamptz not null);`,
    )
    this.addSql(`insert into "link_settings" ("id", "rules", "updated_at") values ('default', '[]', now());`)
    this.addSql(`alter table "media_reference" add column "friend_link_id" int null;`)
    this.addSql(
      `alter table "media_reference" add constraint "media_reference_friend_link_id_foreign" foreign key ("friend_link_id") references "friend_link" ("id") on update cascade on delete cascade;`,
    )
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "media_reference" drop constraint "media_reference_friend_link_id_foreign";`)
    this.addSql(`alter table "media_reference" drop column "friend_link_id";`)
    this.addSql(`drop table "friend_link";`)
    this.addSql(`drop table "link_settings";`)
  }
}
