/**
 * @file 20260909045323_add_moments.ts
 * @description 新增独立朋友圈动态、评论、点赞及媒体引用；不修改既有内容。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260909045323_add_moments extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "moment" ("id" text not null, "content" text not null, "topics" jsonb not null default \'[]\', "images" jsonb not null default \'[]\', "location" text null, "device" text null, "mood" text null, "linked_article_id" int null, "linked_link" jsonb null, "status" text not null default \'draft\', "revision" int not null default 0, "is_pinned" boolean not null default false, "likes" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "moment_pkey" primary key ("id"));',
    )
    this.addSql(
      'create index "moment_status_deleted_at_is_pinned_published_at_id_index" on "moment" ("status", "deleted_at", "is_pinned", "published_at", "id");',
    )
    this.addSql('alter table "moment" add constraint "moment_request_id_unique" unique ("request_id");')
    this.addSql(
      'create table "moment_like" ("id" serial primary key, "moment_id" text not null, "visitor_id_hash" text not null, "created_at" timestamptz not null);',
    )
    this.addSql(
      'alter table "moment_like" add constraint "moment_like_moment_id_visitor_id_hash_unique" unique ("moment_id", "visitor_id_hash");',
    )
    this.addSql(
      'create table "moment_comment" ("id" text not null, "moment_id" text not null, "visitor_id_hash" text not null, "author" text not null, "avatar" text not null, "content" text not null, "is_owner" boolean not null default false, "status" text not null default \'published\', "request_id" text null, "request_hash" text null, "deleted_at" timestamptz null, "created_at" timestamptz not null, constraint "moment_comment_pkey" primary key ("id"));',
    )
    this.addSql(
      'create index "moment_comment_moment_id_status_created_at_id_index" on "moment_comment" ("moment_id", "status", "created_at", "id");',
    )
    this.addSql(
      'alter table "moment_comment" add constraint "moment_comment_moment_id_visitor_id_hash_request_id_unique" unique ("moment_id", "visitor_id_hash", "request_id");',
    )
    this.addSql(
      'alter table "moment" add constraint "moment_linked_article_id_foreign" foreign key ("linked_article_id") references "post" ("id") on update cascade on delete set null;',
    )
    this.addSql(
      'alter table "moment_like" add constraint "moment_like_moment_id_foreign" foreign key ("moment_id") references "moment" ("id") on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table "moment_comment" add constraint "moment_comment_moment_id_foreign" foreign key ("moment_id") references "moment" ("id") on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table "media_reference" add column "moment_id" text null, add column "moment_comment_id" text null;',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_moment_id_foreign" foreign key ("moment_id") references "moment" ("id") on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_moment_comment_id_foreign" foreign key ("moment_comment_id") references "moment_comment" ("id") on update cascade on delete cascade;',
    )
  }
  override async down(): Promise<void> {
    this.addSql("delete from media_reference where kind in ('moment','moment-comment');")
    this.addSql('alter table media_reference drop column moment_comment_id, drop column moment_id;')
    this.addSql('drop table moment_comment;')
    this.addSql('drop table moment_like;')
    this.addSql('drop table moment;')
  }
}
