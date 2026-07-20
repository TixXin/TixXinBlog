import { Migration } from '@mikro-orm/migrations'

export class Migration20260720125632 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create type "post_category" as enum ('tech', 'life');`)
    this.addSql(`create type "post_status" as enum ('draft', 'published', 'archived');`)
    this.addSql(
      `create table "post" ("id" serial primary key, "title" text not null, "slug" text null, "summary" text not null, "cover" text null, "category" "post_category" not null, "folder" text not null, "read_time_minutes" int not null, "content_raw" text null, "content_sections" jsonb null, "pinned" boolean not null default false, "status" "post_status" not null default 'published', "published_at" timestamptz not null, "views" int not null default 0, "likes" int not null default 0, "comment_count" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    )
    this.addSql(`create index "post_slug_index" on "post" ("slug");`)
    this.addSql(`create index "post_status_index" on "post" ("status");`)
    this.addSql(`create index "post_published_at_index" on "post" ("published_at");`)

    this.addSql(
      `create table "post_like" ("id" serial primary key, "post_id" int not null, "visitor_id_hash" text not null, "created_at" timestamptz not null);`,
    )
    this.addSql(
      `alter table "post_like" add constraint "post_like_post_id_visitor_id_hash_unique" unique ("post_id", "visitor_id_hash");`,
    )

    this.addSql(
      `create table "post_tag" ("id" serial primary key, "label" text not null, "slug" text not null, "color" text not null default 'blue', "count" int not null default 0);`,
    )
    this.addSql(`alter table "post_tag" add constraint "post_tag_label_unique" unique ("label");`)
    this.addSql(`alter table "post_tag" add constraint "post_tag_slug_unique" unique ("slug");`)

    this.addSql(
      `create table "post_tag_map" ("post_id" int not null, "post_tag_id" int not null, constraint "post_tag_map_pkey" primary key ("post_id", "post_tag_id"));`,
    )

    this.addSql(
      `create table "post_view" ("id" serial primary key, "post_id" int not null, "visitor_id_hash" text not null, "hour_bucket" timestamptz not null, "created_at" timestamptz not null);`,
    )
    this.addSql(
      `alter table "post_view" add constraint "post_view_post_id_visitor_id_hash_hour_bucket_unique" unique ("post_id", "visitor_id_hash", "hour_bucket");`,
    )

    this.addSql(
      `alter table "post_like" add constraint "post_like_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "post_tag_map" add constraint "post_tag_map_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "post_tag_map" add constraint "post_tag_map_post_tag_id_foreign" foreign key ("post_tag_id") references "post_tag" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "post_view" add constraint "post_view_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;`,
    )
  }
}
