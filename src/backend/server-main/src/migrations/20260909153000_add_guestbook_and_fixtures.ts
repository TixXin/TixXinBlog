/** @file 20260909153000_add_guestbook_and_fixtures.ts @description 增加独立留言、回应及开发样本归属，不改写现有业务记录 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260909153000_add_guestbook_and_fixtures extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "development_fixture" ("key" text not null, "dataset" text not null, "kind" text not null, "resource_id" text not null, "snapshot_hash" text not null, "created_at" timestamptz not null, constraint "development_fixture_pkey" primary key ("key"));',
    )
    this.addSql('create index "development_fixture_dataset_index" on "development_fixture" ("dataset");')
    this.addSql(
      `create table "guestbook_message" ("id" serial primary key, "visitor_id_hash" text not null, "author" text not null, "avatar" text not null, "content" text not null, "reply_to_id" int null, "status" text not null default 'published', "revision" int not null default 0, "is_owner" boolean not null default false, "is_pinned" boolean not null default false, "request_id" text null, "request_hash" text null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    )
    this.addSql('create index "guestbook_reply_idx" on "guestbook_message" ("reply_to_id");')
    this.addSql(
      `create unique index "guestbook_single_pinned" on "guestbook_message" ("is_pinned") where "is_pinned" = true and "status" = 'published' and "deleted_at" is null;`,
    )
    this.addSql(
      'create index "guestbook_visibility_order_idx" on "guestbook_message" ("status", "deleted_at", "created_at", "id");',
    )
    this.addSql(
      'alter table "guestbook_message" add constraint "guestbook_submission_unique" unique ("visitor_id_hash", "request_id");',
    )
    this.addSql(
      'create table "guestbook_reaction" ("id" serial primary key, "message_id" int not null, "visitor_id_hash" text not null, "emoji" text not null, "created_at" timestamptz not null);',
    )
    this.addSql(
      'alter table "guestbook_reaction" add constraint "guestbook_reaction_unique" unique ("message_id", "visitor_id_hash", "emoji");',
    )
    this.addSql(
      'alter table "guestbook_message" add constraint "guestbook_message_reply_to_id_foreign" foreign key ("reply_to_id") references "guestbook_message" ("id") on update cascade on delete set null;',
    )
    this.addSql(
      'alter table "guestbook_reaction" add constraint "guestbook_reaction_message_id_foreign" foreign key ("message_id") references "guestbook_message" ("id") on update cascade on delete cascade;',
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table "guestbook_reaction";')
    this.addSql('drop table "guestbook_message";')
    this.addSql('drop table "development_fixture";')
  }
}
